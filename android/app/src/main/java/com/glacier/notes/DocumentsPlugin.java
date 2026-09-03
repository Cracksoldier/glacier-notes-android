package com.glacier.notes;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;

/**
 * The Storage Access Framework, and nothing else: two system dialogs, no
 * permission, no persisted URI grant, no state kept between calls.
 *
 * This is hand-written rather than taken from a plugin because no maintained
 * Capacitor 8 plugin implements ACTION_CREATE_DOCUMENT. Since that half had to
 * be written anyway, opening lives here too, which keeps the content:// URI on
 * this side of the bridge — TypeScript only ever sees text and a display name.
 *
 * Every rejection message here is a compile-time constant, and no Exception is
 * ever handed to reject(): PluginCall.reject(msg, code, ex, data) passes the
 * throwable straight to Logger.error, and a FileNotFoundException's message is
 * the document's path.
 */
@CapacitorPlugin(name = "Documents")
public class DocumentsPlugin extends Plugin {

    /**
     * EXTRA_MIME_TYPES is an allow-list, not a hint: a type missing from it makes
     * the user's own backup unselectable with no explanation at all. A .json file
     * is reported as application/json by DocumentsUI (which derives it from the
     * extension), as application/octet-stream by providers that do not recognise
     * the extension, and as text/plain by a few that sniff — so this list is
     * deliberately wider than "the correct answer". The real filter is
     * validateEnvelope, which can tell a Glacier export from other JSON and says
     * why; a MIME type never could.
     */
    private static final String[] OPEN_MIME_TYPES = { "application/json", "application/octet-stream", "text/plain" };

    private static final String MIME_JSON = "application/json";

    /** Far above any real export, and only here so a wrong pick cannot OOM. */
    private static final int MAX_CHARS = 64 * 1024 * 1024;
    private static final int BUFFER_CHARS = 16 * 1024;

    private static final String ERR_BAD_REQUEST = "bad-request";
    private static final String ERR_READ = "read-failed";
    private static final String ERR_WRITE = "write-failed";
    private static final String ERR_TOO_LARGE = "too-large";

    @PluginMethod
    public void openDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, OPEN_MIME_TYPES);
        // No EXTRA_LOCAL_ONLY: restoring a backup out of a cloud provider is that
        // provider's network, not ours, and needs no INTERNET permission here.
        startActivityForResult(call, intent, "handleOpen");
    }

    @PluginMethod
    public void createDocument(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || fileName.isEmpty() || call.getString("data") == null) {
            call.reject(ERR_BAD_REQUEST, ERR_BAD_REQUEST);
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", MIME_JSON));
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "handleCreate");
    }

    /**
     * ActivityResultRegistry dispatches this on the main thread, unlike a
     * @PluginMethod body, which Bridge already posts to its own HandlerThread.
     * A multi-megabyte read inline here would be an ANR, so the I/O is handed
     * back to that thread.
     */
    @ActivityCallback
    private void handleOpen(PluginCall call, ActivityResult result) {
        if (call == null) {
            // Both saved-call lookups missed, which the base class allows for.
            return;
        }
        Uri uri = pickedUri(result);
        if (uri == null) {
            call.resolve(cancelled());
            return;
        }

        getBridge()
            .execute(() -> {
                String text;
                try {
                    text = readText(uri);
                } catch (TooLargeException e) {
                    call.reject(ERR_TOO_LARGE, ERR_TOO_LARGE);
                    return;
                } catch (Exception e) {
                    call.reject(ERR_READ, ERR_READ);
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("cancelled", false);
                ret.put("name", displayName(uri));
                ret.put("text", text);
                call.resolve(ret);
            });
    }

    @ActivityCallback
    private void handleCreate(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        Uri uri = pickedUri(result);
        if (uri == null) {
            call.resolve(cancelled());
            return;
        }
        String data = call.getString("data");
        if (data == null) {
            call.reject(ERR_WRITE, ERR_WRITE);
            return;
        }

        getBridge()
            .execute(() -> {
                try {
                    writeText(uri, data);
                } catch (Exception e) {
                    // ACTION_CREATE_DOCUMENT has already created the document, so a
                    // failed write would leave a truncated .glacier.json the user
                    // could mistake for a backup. Same invariant as the exporter's:
                    // a partial file is worse than no file.
                    deleteQuietly(uri);
                    call.reject(ERR_WRITE, ERR_WRITE);
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("cancelled", false);
                ret.put("name", displayName(uri));
                call.resolve(ret);
            });
    }

    /**
     * The base class writes the saved call's entire options JSON into the
     * Activity Bundle. For createDocument that is the whole export — every note
     * body and every base64 image — crossing a Binder into system_server and
     * being persisted with the task record, which breaks the rule that note
     * content never leaves the app, and exceeds the transaction limit besides.
     * The cost of returning null is losing a picker the user was in the middle
     * of when Android killed the activity.
     */
    @Override
    protected Bundle saveInstanceState() {
        return null;
    }

    private Uri pickedUri(ActivityResult result) {
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            return null;
        }
        return data.getData();
    }

    private JSObject cancelled() {
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        return ret;
    }

    /**
     * DISPLAY_NAME is the only user-meaningful name a content:// URI has; its
     * last path segment is a provider document id such as "msf:1000000123". A
     * provider need not implement the column, hence the index check rather than
     * getString(0), and a null name is fine — the UI substitutes its own.
     */
    private String displayName(Uri uri) {
        String[] projection = { OpenableColumns.DISPLAY_NAME };
        try (Cursor cursor = getContext().getContentResolver().query(uri, projection, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0 && !cursor.isNull(index)) {
                    return cursor.getString(index);
                }
            }
        } catch (Exception e) {
            // A name is cosmetic and the caller has a fallback.
        }
        return null;
    }

    private String readText(Uri uri) throws IOException, TooLargeException {
        ContentResolver resolver = getContext().getContentResolver();
        try (InputStream in = resolver.openInputStream(uri)) {
            if (in == null) {
                throw new IOException();
            }
            try (Reader reader = new InputStreamReader(in, StandardCharsets.UTF_8)) {
                StringBuilder out = new StringBuilder();
                char[] buffer = new char[BUFFER_CHARS];
                int read;
                while ((read = reader.read(buffer)) != -1) {
                    if (out.length() + read > MAX_CHARS) {
                        throw new TooLargeException();
                    }
                    out.append(buffer, 0, read);
                }
                return out.toString();
            }
        }
    }

    /**
     * "wt" and not "w": several providers do not truncate on plain "w", so
     * overwriting a larger previous export leaves its tail behind and produces a
     * file that is intact on disk and unparseable as JSON.
     */
    private void writeText(Uri uri, String text) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        try (OutputStream out = resolver.openOutputStream(uri, "wt")) {
            if (out == null) {
                throw new IOException();
            }
            try (Writer writer = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
                writer.write(text);
                writer.flush();
            }
        }
    }

    private void deleteQuietly(Uri uri) {
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), uri);
        } catch (Exception e) {
            // Not every provider supports delete, and there is nothing further to do.
        }
    }

    private static final class TooLargeException extends Exception {}
}
