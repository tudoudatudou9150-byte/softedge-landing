const newsletterForm = document.querySelector("#newsletter-form");
const quantityOptions = document.querySelectorAll(".quantity-options button");
const selectedPlan = document.querySelector("#selected-plan");
const selectedPrice = document.querySelector("#selected-price");
const selectedShipping = document.querySelector("#selected-shipping");
const addToCart = document.querySelector("#add-to-cart");
const cartNote = document.querySelector("#cart-note");

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
      const unit = quantity === "1" ? "pc" : "pcs";
      selectedPlan.textContent = `L-Shaped / ${quantity} ${unit}`;
      selectedPrice.innerHTML = `<del>$${compare}</del> $${price}`;
      selectedShipping.textContent = shipping;
    }
  });
});

addToCart?.addEventListener("click", () => {
  if (!cartNote || !selectedPlan || !selectedPrice || !selectedShipping) return;

  cartNote.textContent = `Added ${selectedPlan.textContent} — ${selectedPrice.textContent}, ${selectedShipping.textContent}. Checkout can be connected in Shopify.`;
});

newsletterForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = newsletterForm.querySelector("button");
  const input = newsletterForm.querySelector("input");

  if (button && input) {
    button.textContent = "You're in";
    input.value = "";
    input.placeholder = "Welcome to SOFTEDGE";
  }
});
