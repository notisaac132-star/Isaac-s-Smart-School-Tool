// Donate page: pick Cash App or PayPal, then an amount ($5 to $100). Opens the payment page in the
// browser with the amount already filled in; the payment itself happens on Cash App's / PayPal's site.
(function () {
  const CASHTAG = "$otterac";
  const PAYPAL_EMAIL = "notisaac132@gmail.com";
  const AMOUNTS = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);

  const METHODS = {
    cashapp: {
      name: "Cash App",
      to: CASHTAG,
      url: (amount) => `https://cash.app/${CASHTAG}/${amount}`,
    },
    paypal: {
      name: "PayPal",
      to: PAYPAL_EMAIL,
      url: (amount) =>
        "https://www.paypal.com/cgi-bin/webscr?" +
        new URLSearchParams({
          cmd: "_xclick",
          business: PAYPAL_EMAIL,
          item_name: "Donation to Isaac's Smart School Tool",
          amount: amount.toFixed(2),
          currency_code: "USD",
          no_shipping: "1",
        }),
    },
  };

  const methodButtons = [...document.querySelectorAll(".pay-method")];
  const amountCard = document.getElementById("amount-card");
  const amountTitle = document.getElementById("amount-title");
  const amountsBox = document.getElementById("amounts");
  const message = document.getElementById("donate-message");
  let method = null;

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("success", Boolean(text) && !isError);
    message.classList.toggle("error", Boolean(text) && isError);
  }

  function chooseMethod(key) {
    method = METHODS[key];
    methodButtons.forEach((button) => {
      const selected = button.dataset.method === key;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-checked", String(selected));
    });
    amountTitle.textContent = `How much? (${method.name} → ${method.to})`;
    amountCard.hidden = false;
    setMessage("");
    amountCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function donate(amount) {
    if (!method) return;
    window.open(method.url(amount), "_blank");
    setMessage(`Opened ${method.name} for $${amount}. Finish the payment there. Thank you so much! 💙`);
  }

  methodButtons.forEach((button) => button.addEventListener("click", () => chooseMethod(button.dataset.method)));

  amountsBox.replaceChildren(
    ...AMOUNTS.map((amount) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "amount-btn";
      button.textContent = `$${amount}`;
      button.addEventListener("click", () => donate(amount));
      return button;
    })
  );

  // Start fresh each time the page is opened.
  window.addEventListener("hashchange", () => {
    if (location.hash !== "#donate") return;
    method = null;
    methodButtons.forEach((button) => {
      button.classList.remove("selected");
      button.setAttribute("aria-checked", "false");
    });
    amountCard.hidden = true;
    setMessage("");
  });
})();
