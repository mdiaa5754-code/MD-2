package com.example

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    setContent {
      MdCarpetsApp(activity = this)
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MdCarpetsApp(activity: ComponentActivity) {
  var webViewInstance by remember { mutableStateOf<WebView?>(null) }
  var canGoBack by remember { mutableStateOf(false) }

  BackHandler(enabled = canGoBack) {
    webViewInstance?.let { wv ->
      if (wv.canGoBack()) {
        wv.goBack()
      }
    }
  }

  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(Color(0xFFFAF5EA))
      .systemBarsPadding()
      .testTag("md_carpets_container")
  ) {
    AndroidView(
      modifier = Modifier
        .fillMaxSize()
        .testTag("md_carpets_webview"),
      factory = { context ->
        WebView(context).apply {
          layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
          )
          setBackgroundColor(android.graphics.Color.parseColor("#FAF5EA"))

          settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
          }

          webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
              view: WebView?,
              request: WebResourceRequest?
            ): Boolean {
              val url = request?.url?.toString() ?: return false
              return handleDeepLinks(url, activity)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
              if (url == null) return false
              return handleDeepLinks(url, activity)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
              super.onPageStarted(view, url, favicon)
              canGoBack = view?.canGoBack() == true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
              super.onPageFinished(view, url)
              canGoBack = view?.canGoBack() == true
            }
          }

          webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
              return super.onConsoleMessage(consoleMessage)
            }
          }

          loadUrl("file:///android_asset/index.html")
          webViewInstance = this
        }
      },
      update = { wv ->
        webViewInstance = wv
      }
    )
  }

  DisposableEffect(Unit) {
    onDispose {
      webViewInstance?.destroy()
      webViewInstance = null
    }
  }
}

/**
 * معالجة روابط الواتساب والمكالمات الهاتفية والمواقع الخارجية لفتحها في تطبيقات الهاتف الأصلية
 */
private fun handleDeepLinks(url: String, activity: ComponentActivity): Boolean {
  return when {
    url.startsWith("https://wa.me/") ||
    url.startsWith("whatsapp://") ||
    url.startsWith("https://api.whatsapp.com/") -> {
      try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        activity.startActivity(intent)
      } catch (_: Exception) {
        try {
          val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
          activity.startActivity(browserIntent)
        } catch (_: Exception) {
          // ignore
        }
      }
      true
    }
    url.startsWith("tel:") -> {
      try {
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse(url))
        activity.startActivity(intent)
      } catch (_: Exception) {
        // ignore
      }
      true
    }
    url.startsWith("http://") || url.startsWith("https://") -> {
      // إذا كان رابط خارجي مثل فيسبوك افتحه خارج التطبيق
      if (!url.contains("localhost") && !url.contains("127.0.0.1") && !url.startsWith("file:///")) {
        try {
          val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
          activity.startActivity(intent)
          true
        } catch (_: Exception) {
          false
        }
      } else {
        false
      }
    }
    else -> false
  }
}
