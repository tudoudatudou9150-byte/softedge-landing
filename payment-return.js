const paymentTitle = document.querySelector("[data-payment-title]");
const paymentMessage = document.querySelector("[data-payment-message]");
const paymentNext = document.querySelector("[data-payment-next]");

const setPaymentState = (title, message, next) => {
  if (paymentTitle) paymentTitle.textContent = title;
  if (paymentMessage) paymentMessage.textContent = message;
  if (paymentNext) paymentNext.textContent = next;
};

const confirmPayment = async () => {
  const params = new URLSearchParams(window.location.search);
  const paypalOrderId = params.get("token");

  if (!paypalOrderId) {
    setPaymentState(
      "We could not find your PayPal order.",
      "Your payment was not confirmed because PayPal did not return an order token.",
      "Please contact support if you were charged."
    );
    return;
  }

  try {
    const response = await fetch("/api/capture-paypal-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paypalOrderId })
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Payment confirmation failed.");

    setPaymentState(
      "Payment confirmed.",
      result.orderNumber ? `Order ${result.orderNumber} is now paid.` : "Your order is now paid.",
      "Taking you to your orders..."
    );

    window.setTimeout(() => {
      window.location.href = "orders.html";
    }, 1800);
  } catch (error) {
    setPaymentState(
      "Payment needs review.",
      error.message,
      "Please contact support if PayPal shows that you were charged."
    );
  }
};

confirmPayment();
