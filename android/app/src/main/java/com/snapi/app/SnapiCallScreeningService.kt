package com.snapi.app

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

class SnapiCallScreeningService : CallScreeningService() {

  override fun onScreenCall(callDetails: Call.Details) {
    try {
      val incoming = callDetails.handle?.schemeSpecificPart ?: ""
      Log.i("SNAPI-CS", "onScreenCall incoming=$incoming")

      // Minimal allow-through response (proves role + service work)
      val response = CallResponse.Builder()
        .setDisallowCall(false)
        .setRejectCall(false)
        .setSkipCallLog(false)
        .setSkipNotification(false)
        .build()

      respondToCall(callDetails, response)
    } catch (e: Throwable) {
      Log.e("SNAPI-CS", "onScreenCall failed", e)
    }
  }
}
