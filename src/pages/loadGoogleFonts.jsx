// loadGoogleFonts.js
const loadGoogleFonts = () => {
  if (!document.querySelector("#certificate-fonts")) {
    const link = document.createElement("link");
    link.id = "certificate-fonts";
    link.href =
      "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Dancing+Script&family=Pacifico&family=Playfair+Display&family=Roboto&family=Lora&family=Cinzel&family=Merriweather&family=Satisfy&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
};
export default loadGoogleFonts;
