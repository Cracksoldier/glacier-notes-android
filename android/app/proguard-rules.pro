# R8 keep rules for the release build (M16). See docs/release.md.
#
# Capacitor's core AAR already ships consumer rules that keep every
# @CapacitorPlugin class and everything extending com.getcapacitor.Plugin
# (node_modules/@capacitor/android/capacitor/proguard-rules.pro), so plugins that
# arrive as AARs need nothing here.
#
# What that does not cover is a plugin included as a Gradle *project*: a project
# dependency propagates rules only through consumerProguardFiles, and
# @capacitor-community/sqlite declares none. Everything below exists for that gap
# or for code reached from JNI, which R8 cannot see at all.

# The Activity is named as a string in AndroidManifest.xml, and it registers
# DocumentsPlugin by class literal before super.onCreate.
-keep class com.glacier.notes.MainActivity { *; }
-keep class com.glacier.notes.DocumentsPlugin { *; }

# Capacitor resolves plugin classes by name from assets/capacitor.plugins.json and
# invokes @PluginMethod members reflectively from the bridge.
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.community.database.sqlite.** { *; }

# SQLCipher's Java classes are called from its own native library; the JNI side
# looks them up by name, so R8 renaming them breaks the database at open time and
# not at build time. Linked whether or not encryption is used (docs/hardening.md §9).
-keep class net.zetetic.** { *; }
-keep class androidx.sqlite.** { *; }

# Room generates the sqlite plugin's DAO implementations by name.
-keep class * extends androidx.room.RoomDatabase { *; }
-dontwarn androidx.room.paging.**

# Compile-time-only annotations, absent from the runtime classpath by design.
# Google Tink references them; Tink arrives through androidx.security:security-crypto,
# which @capacitor-community/sqlite pulls in for the encrypted-database mode this app
# deliberately does not use (docs/hardening.md §9). R8 reports them as missing classes
# and fails the build until they are silenced. These six are exactly what AGP asked for
# in build/outputs/mapping/release/missing_rules.txt — not a guess.
-dontwarn com.google.errorprone.annotations.CanIgnoreReturnValue
-dontwarn com.google.errorprone.annotations.CheckReturnValue
-dontwarn com.google.errorprone.annotations.Immutable
-dontwarn com.google.errorprone.annotations.RestrictedApi
-dontwarn javax.annotation.Nullable
-dontwarn javax.annotation.concurrent.GuardedBy
