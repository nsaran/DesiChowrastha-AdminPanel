import "./assets/css/tvmenu-styles.css";
import VEG from "./assets/images/veg.png";
import NONVEG from "./assets/images/nonveg.png";
import EGG from "./assets/images/egg.png";
import CHILLI from "./assets/images/chilli.png";

export const renderToastMenuItems = (menu, category, onItemClick) => {
  const reducedSpacingCategories = [
    "Tiffins", "Breads", "Sides", "Veg Curries", "Non-Veg Curries", "Pulao",
    "Veg Appetizers"
  ];

  const categoryExceptions = new Set([
    "Snacks (Available from 5 PM)", "Snacks (Available from 4:00 PM)", "Drinks",
    "Desserts", "Sweets and Snacks", "Naan(Garlic/Butter/Plain)",
    "Sides", "Breads", "Extra Food Items Open Kitchen", "Indian Wok(Fried Rice/Noodles)",
    "Rice Specials", "Indian Wok", "Lunch Combo - Weekdays Only(11AM-2:30)",
    "Extra Food Items Main Kitchen", "Chowrastha Specials", "Bakery",
    "Lunch Combo - Weekdays Only", "Pastries", "Falooda", "Lunch Combo - Weekdays Only(11AM-1:30)"
  ]);

  const validItemTypes = new Set(["Veg", "Non-Veg", "Egg"]);

  if (!menu || !menu[0] || !menu[0].menuGroups) {
    return null;
  }

  const filteredMenu = menu[0].menuGroups.filter(item => item.name === category);

  return filteredMenu.map(group => (group.menuItems || [])
    .filter(item => item.name)
    .map(item => {
      // Check for the specific item name and update it
      let itemName = item.name === "Breakfast Combo ( Idly, Vada, Upma or Pongal) ( 8AM - 12 PM)" 
                       ? "Combo (Idly, Vada, Upma / Pongal) (8AM - 12 PM)" 
                       : item.name;

      // Remove "Family Pack" from the item name if it exists
      if (itemName.includes("Family Pack")) {
        itemName = itemName.replace("Family Pack", "").trim();
      }

      const itemTypeImage = item.itemType === "Veg" ? VEG : item.itemType === "Non-Veg" ? NONVEG : item.itemType === "Egg" ? EGG : null;
      const shouldApplyMargin = !itemTypeImage && !categoryExceptions.has(category);

      // Determine spice level
      let spiceLevelImages = [];
      if (item.spiceLevel) {
        const spiceLevel = item.spiceLevel.toLowerCase();
         if (spiceLevel === 'medium') {
          spiceLevelImages.push(
            <img key="medium-1" src={CHILLI} alt="Medium" className="menu-item-icon" />,
            
          );
        } else if (spiceLevel === 'spicy') {
          spiceLevelImages.push(
            <img key="spicy-1" src={CHILLI} alt="Spicy" className="menu-item-icon" />,
            <img key="spicy-2" src={CHILLI} alt="Spicy" className="menu-item-icon" />,
           
          );
        }
      }

      return (
        <div
          key={item.id}
          className={`menu-item ${reducedSpacingCategories.includes(category) ? "reduced-spacing" : ""} ${category === "Non-Veg  Appetizers" ? "non-veg-appetizers-item" : ""} ${category === "FamilyPack  Biryani's" ? "familypack-biryani-item" : ""} ${category === "Chowrastha Specials" ? "chowrastha-specials-item" : ""} ${category === "Desserts" ? "desserts-item" : ""}`}
          onClick={() => onItemClick && onItemClick(item)}
          style={{ cursor: onItemClick ? 'pointer' : 'default' }}
        >
          <h4 className={item.isAvailable === false ? "sold-out-menu-item-name" : ""}>
            {itemTypeImage && !categoryExceptions.has(category) && (
              <img
                src={itemTypeImage}
                alt={item.name}
                className="menu-item-icon"
              />
            )}
            <span className={item.itemType ? "" : "undefined-item"} style={shouldApplyMargin ? { marginLeft: "30px" } : {}}>
              {itemName}
            </span>
            {spiceLevelImages}
            <span className="menu-item-price">
              {item.isAvailable === false ? "N/A" : `$ ${parseFloat(item.price || 0).toFixed(2)}`}
            </span>
          </h4>
        </div>
      );
    })
  );
};
