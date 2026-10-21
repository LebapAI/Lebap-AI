function waitForElm(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver((_mutations) => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

// Force change the Swagger logo in the header
waitForElm(".topbar-wrapper").then((elm) => {
  if (window.SWAGGER_DOCS_ENV === "development") {
    elm.innerHTML = `<a href='${window.location.origin}'><img src='http://localhost:3000/lebap-ai-logo.svg' alt='Lebap AI' width='200'/></a>`;
  } else {
    elm.innerHTML = `<a href='${window.location.origin}'><img src='${window.location.origin}/lebap-ai-logo.svg' alt='Lebap AI' width='200'/></a>`;
  }
});
