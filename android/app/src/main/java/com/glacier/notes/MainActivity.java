package com.glacier.notes;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Before super, which builds the Bridge at the end of its own body.
        // BridgeActivity loads plugins from assets/capacitor.plugins.json, which
        // `cap sync` generates from node_modules only — there is no annotation
        // scanning, so a plugin living in the app module is invisible without this.
        registerPlugin(DocumentsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
