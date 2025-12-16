package hu.elitdroszt.mobile

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*

class UnusedAppsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName() = "UnusedAppsModule"
    
    /**
     * Check if app is whitelisted from auto-revoke (unused apps hibernation)
     * Returns true if app is EXEMPT (switch is OFF) - GOOD
     * Returns false if app is NOT exempt (switch is ON) - BAD
     */
    @ReactMethod
    fun isWhitelisted(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val pm = reactApplicationContext.packageManager
                val whitelisted = pm.isAutoRevokeWhitelisted
                promise.resolve(whitelisted)
            } else {
                // Android < 11: feature doesn't exist, assume OK
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
    
    /**
     * Open app settings where user can disable "Remove permissions if app isn't used"
     */
    @ReactMethod
    fun openSettings() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", reactApplicationContext.packageName, null)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Fallback to general app settings
            val intent = Intent(Settings.ACTION_SETTINGS)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
        }
    }
}
