package com.snapi.app

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

class SnapiCallScreeningService : CallScreeningService() {

  override fun onScreenCall(callDetails: Call.Details) {
    try {
      val incoming = callDetails.handle?.schemeSpecificPart ?: ""
      Log.i("SNAPI-CS", "onScreenCall incoming=$incoming")

      // ✅ Silent intercept (test mode)
      val response = CallResponse.Builder()
        .setDisallowCall(false)
        .setRejectCall(false)
        .setSilenceCall(true)
        .setSkipCallLog(false)
        .setSkipNotification(true)
        .build()

      respondToCall(callDetails, response)
    } catch (e: Throwable) {
      Log.e("SNAPI-CS", "onScreenCall failed", e)
    }
  }
}
