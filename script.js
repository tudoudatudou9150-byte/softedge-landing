const newsletterForm = document.querySelector("#newsletter-form");
const quantityOptions = document.querySelectorAll(".quantity-options button");
const selectedPlan = document.querySelector("#selected-plan");
const selectedPrice = document.querySelector("#selected-price");
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

    if (selectedPlan && selectedPrice && quantity && price) {
      const unit = quantity === "1" ? "pc" : "pcs";
      selectedPlan.textContent = `L-Shaped / ${quantity} ${unit}`;
      selectedPrice.textContent = `A$${price}`;
    }
  });
});

addToCart?.addEventListener("click", () => {
  if (!cartNote || !selectedPlan || !selectedPrice) return;

  cartNote.textContent = `Added ${selectedPlan.textContent} — ${selectedPrice.textContent}. Checkout can be connected in Shopify.`;
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
