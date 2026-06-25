const styleOptions = document.querySelectorAll(".style-options .style-option");
const quantityOptions = document.querySelectorAll(".quantity-options button");
const productKicker = document.querySelector("#product-kicker");
const productTitle = document.querySelector("#product-title");
const productDescription = document.querySelector("#product-description");
const productImage = document.querySelector("#product-image");
const selectedPlan = document.querySelector("#selected-plan");
const selectedPrice = document.querySelector("#selected-price");
const selectedShipping = document.querySelector("#selected-shipping");
const addToCart = document.querySelector("#add-to-cart");
const cartNote = document.querySelector("#cart-note");
const offerCountdown = document.querySelector("#offer-countdown");
const paypalCheckout = document.querySelector("#paypal-checkout");
const paypalItemName = document.querySelector("#paypal-item-name");
const paypalAmount = document.querySelector("#paypal-amount");
const paypalShipping = document.querySelector("#paypal-shipping");

let selectedStyle = "L-Shaped";

const getSelectedQuantity = () => {
  const selected = document.querySelector(".quantity-options button.selected");
  return selected?.dataset.qty || "16";
};

const getSelectedQuantityOption = () => document.querySelector(".quantity-options button.selected");

const updateSelectedPlan = () => {
  if (!selectedPlan) return;

  const quantity = getSelectedQuantity();
  const unit = quantity === "1" ? "pc" : "pcs";
  selectedPlan.textContent = `${selectedStyle} / ${quantity} ${unit}`;
};

const updatePaypalCheckout = () => {
  const selectedQuantity = getSelectedQuantityOption();
  if (!selectedQuantity || !paypalItemName || !paypalAmount) return;

  const quantity = selectedQuantity.dataset.qty || "16";
  const unit = quantity === "1" ? "pc" : "pcs";
  const price = Number(selectedQuantity.dataset.price || "112");
  const freeShipping = selectedQuantity.dataset.freeShipping === "true";

  const productName = productTitle?.textContent || `${selectedStyle} Corner Guard`;
  paypalItemName.value = `Nubohome ${productName} / ${quantity} ${unit}`;
  paypalAmount.value = price.toFixed(2);

  if (paypalShipping) {
    paypalShipping.disabled = !freeShipping;
    paypalShipping.value = "0.00";
  }
};

styleOptions.forEach((option) => {
  option.addEventListener("click", () => {
    styleOptions.forEach((item) => {
      item.classList.remove("selected");
      item.setAttribute("aria-pressed", "false");
    });
    option.classList.add("selected");
    option.setAttribute("aria-pressed", "true");

    selectedStyle = option.dataset.style || "L-Shaped";

    if (productKicker && option.dataset.kicker) {
      productKicker.textContent = option.dataset.kicker;
    }
    if (productTitle && option.dataset.title) {
      productTitle.textContent = option.dataset.title;
    }
    if (productDescription && option.dataset.description) {
      productDescription.textContent = option.dataset.description;
    }
    if (productImage && option.dataset.image) {
      productImage.src = option.dataset.image;
      productImage.alt = option.dataset.alt || "";
    }

    updateSelectedPlan();
    updatePaypalCheckout();
  });
});

quantityOptions.forEach((option) => {
  option.addEventListener("click", () => {
    quantityOptions.forEach((item) => {
      item.classList.remove("selected");
      item.setAttribute("aria-pressed", "false");
    });
    option.classList.add("selected");
    option.setAttribute("aria-pressed", "true");

    const quantity = option.dataset.qty;
    const price = option.dataset.price;
    const compare = option.dataset.compare;
    const shipping = option.dataset.shipping;

    if (selectedPlan && selectedPrice && selectedShipping && quantity && price && compare && shipping) {
      updateSelectedPlan();
      selectedPrice.innerHTML = `<del>$${compare}</del> $${price}`;
      selectedShipping.textContent = shipping;
      updatePaypalCheckout();
    }
  });
});

paypalCheckout?.addEventListener("submit", () => {
  if (!cartNote || !selectedPlan || !selectedPrice || !selectedShipping) return;

  updatePaypalCheckout();
  cartNote.textContent = `Opening PayPal checkout for ${selectedPlan.textContent} — ${selectedPrice.textContent}, ${selectedShipping.textContent}.`;
});

updatePaypalCheckout();

if (offerCountdown) {
  const offerDuration = 2 * 60 * 60 * 1000;

  const tickOffer = () => {
    const remaining = offerDuration - (Date.now() % offerDuration);
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    offerCountdown.textContent = `${hours}:${minutes}:${seconds}`;
    offerCountdown.setAttribute("datetime", `PT${hours}H${minutes}M${seconds}S`);
  };

  tickOffer();
  setInterval(tickOffer, 1000);
}
