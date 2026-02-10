package com.snapi.app

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

class SnapiCallScreeningService : CallScreeningService() {

  override fun onScreenCall(callDetails: Call.Details) {
    try {
      val incoming = callDetails.handle?.schemeSpecificPart ?: ""
      val isPrivate = incoming.isBlank() // private/anonymous often has no number

      Log.i("SNAPI-CS", "onScreenCall incoming=$incoming private=$isPrivate")

      val b = CallResponse.Builder()

      if (isPrivate) {
        // ✅ STOP RING (reliable on Samsung/Verizon)
        b.setDisallowCall(true)
          .setRejectCall(true)
          .setSilenceCall(true)
          .setSkipNotification(true)
          .setSkipCallLog(false)
      } else {
        // allow for now (we’ll add contact-vs-unknown next)
        b.setDisallowCall(false)
          .setRejectCall(false)
          .setSilenceCall(false)
          .setSkipNotification(false)
          .setSkipCallLog(false)
      }

      respondToCall(callDetails, b.build())
    } catch (e: Throwable) {
      Log.e("SNAPI-CS", "onScreenCall failed", e)
    }
  }
}
