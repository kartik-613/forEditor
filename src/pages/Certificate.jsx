import { v4 as uuidv4 } from "uuid";
import React, { useRef, useState, useEffect } from "react";
import Moveable from "react-moveable";
import fontOptions from "./fontOptions";
import loadGoogleFonts from "./loadGoogleFonts";
import axios from "axios";
import CertificatePopup from "./CertificatePopup";

const API_PATH = import.meta.env.VITE_API_PATH;
const API_KEY = import.meta.env.VITE_API_KEY;

export default function Certificate() {
  const transientRef = useRef({
    // [el.id]: { startX, startY, tx, ty, startW, startH, startRotate }
  });

  const certificateRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [templateFiles, setTemplateFiles] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);

  const [imgPath, setImgPath] = useState("");
  const [imgUrl, setImgUrl] = useState([]);

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const getCanvasRect = () => {
    const r = certificateRef.current?.getBoundingClientRect();
    return r || { left: 0, top: 0, width: 0, height: 0 };
  };

  const getElementSize = (el, target) => {
    // prefer state width/height if present, else measure current
    if (el.type === "photo") {
      return {
        w: el.width ?? target?.getBoundingClientRect().width ?? 0,
        h: el.height ?? target?.getBoundingClientRect().height ?? 0,
      };
    }
    // text: use its box
    const rect = target?.getBoundingClientRect();
    return { w: rect?.width ?? 0, h: rect?.height ?? 0 };
  };

  // Load Google Fonts once
  useEffect(() => {
    loadGoogleFonts();
  }, []);

  // --- State Initialization ---
  const [templateGallery, setTemplateGallery] = useState(() => {
    try {
      const s = localStorage.getItem("template-gallery");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [photoGallery, setPhotoGallery] = useState(() => {
    try {
      const s = localStorage.getItem("photo-gallery");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [template, setTemplate] = useState(() => {
    return localStorage.getItem("cert-template") || "";
  });

  const [elements, setElements] = useState(() => {
    try {
      const s = localStorage.getItem("cert-elements");
      return s
        ? JSON.parse(s).map((el) => ({ ...el, ref: React.createRef() }))
        : [];
    } catch {
      return [];
    }
  });

  const [variables, setVariables] = useState([]);
  const [variablesList, setVariablesList] = useState([]);

  const [variableName, setVariableName] = useState("");
  const [targets, setTargets] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Keep targets in sync and persist simple elements
  useEffect(() => {
    setTargets(elements.map((el) => el.ref.current).filter(Boolean));
    try {
      const serializable = elements.map(({ ref, ...rest }) => rest);
      localStorage.setItem("cert-elements", JSON.stringify(serializable));
    } catch {}
  }, [elements]);

  // Persist galleries, template, and variables
  useEffect(() => {
    try {
      localStorage.setItem("template-gallery", JSON.stringify(templateGallery));
      localStorage.setItem("photo-gallery", JSON.stringify(photoGallery));
      localStorage.setItem("cert-template", template || "");
      localStorage.setItem("cert-variables", JSON.stringify(variables));
    } catch {}
  }, [templateGallery, photoGallery, template, variables]);

  // Check saved HTML on load
  useEffect(() => {
    const savedHTML = localStorage.getItem("certificate-html");
    if (savedHTML) {
      console.log("📄 Saved HTML available in localStorage");
    }
  }, []);

  const handleTemplatePhotoUpload = async (e) => {
    const file = e.target.files[0];
    const inputId = e.target.id;
    if (!file) return;

    const fileName = file.name;

    const uuid = uuidv4();
    const uploadName = `${uuid}-${fileName}`;

    try {
      // 1️⃣ Upload file first
      const formData = new FormData();
      formData.append("file", file, uploadName);

      const uploadRes = await axios.post(
        `${API_PATH}/api/FileAPI/UploadFiles`,
        formData,
        {
          params: { APIKEY: API_KEY },
        }
      );

      const storedName = uploadRes?.data?.[0] || "";

      if (!storedName) throw new Error("No stored filename from upload API");
      // 2️⃣ Save in gallery
      const isBg = inputId === "template" ? 1 : 0;
      // 2️⃣ Save template in gallery
      const galleryRes = await axios.post(
        `${API_PATH}/api/gallery_image`,
        {
          img_path: storedName, // use path from first API
          is_background: isBg,
          title: "Test",
          createdon: new Date().toISOString(),
          createdby: "Test",
        },
        {
          params: { APIKEY: API_KEY },
        }
      );

      // ✅ Update local states so UI updates instantly
      setImgPath(storedName);
    } catch (error) {
      console.error("Error uploading template:", error);
    }
  };

  // 🔄 Re-fetch images whenever a new imgPath arrives (optional but robust)
  useEffect(() => {
    const fetchcertificateImage = async () => {
      try {
        const res = await axios.get(`${API_PATH}/api/certificate_images`, {
          params: { APIKEY: API_KEY, searchtext: "q" },
        });
        const data = res?.data?.Data || [];
        const templates = data.filter((file) => file?.is_background === 1);
        const photos = data.filter((file) => file?.is_background === 0);
        setTemplateFiles(templates);
        setPhotoFiles(photos);
        setImgUrl(data); // Keep full data if needed elsewhere
      } catch (error) {
        console.error("Error fetching certificate images:", error);
      }
    };
    fetchcertificateImage();
  }, [imgPath]); // ✅ depend on imgPath

  const handlePhotoUploadToGallery = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoGallery((prev) => [...prev, url]);
  };

  // Drag start helpers for dataTransfer
  const onDragStartTemplate = (e, file) => {
    e.dataTransfer.setData("type", "template");
    e.dataTransfer.setData("value", file);
  };

  const onDragStartPhoto = (e, file) => {
    e.dataTransfer.setData("type", "photo");
    e.dataTransfer.setData("value", file);
  };

  const onDragStartVariable = (e, key) => {
    e.dataTransfer.setData("type", "variable");
    e.dataTransfer.setData("value", key);
  };

  // Add photo directly by click into the center of the canvas
  const addPhotoToCanvas = (file) => {
    if (!certificateRef.current) return;
    const rect = certificateRef.current.getBoundingClientRect();
    const x = Math.round(rect.width / 2 - 60); // center-ish
    const y = Math.round(rect.height / 2 - 60);
    const newEl = {
      id: Date.now(),
      type: "photo",
      // src: file,
      src: `${API_PATH}/uploads/${file}`,
      x,
      y,
      width: 120,
      height: 120,
      rotate: 0,
      ref: React.createRef(),
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedIndex(elements.length); // select the newly added element
  };

  const addVariableToCanvas = (variable) => {
    if (!certificateRef.current) return;
    const rect = certificateRef.current.getBoundingClientRect();
    const x = Math.round(rect.width / 2 - 60); // center-ish
    const y = Math.round(rect.height / 2 - 20);

    const newEl = {
      id: Date.now(),
      type: "text",
      value: `#${variable}#`,
      fontSize: 24,
      color: "#000",
      fontStyle: "normal",
      fontFamily: "sans-serif",
      letterSpacing: 0,
      x,
      y,
      rotate: 0,
      ref: React.createRef(),
    };

    setElements((prev) => [...prev, newEl]);
    setSelectedIndex(elements.length);
  };

  // Add new text element
  const addTextField = () => {
    const newText = {
      id: Date.now(),
      type: "text",
      value: "New Text",
      fontSize: 24,
      color: "#000000",
      fontStyle: "normal",
      fontFamily: "sans-serif",
      letterSpacing: 0,
      x: 120,
      y: 80,
      width: null,
      height: null,
      rotate: 0,
      ref: React.createRef(),
    };
    setElements((prev) => [...prev, newText]);
    setSelectedIndex(elements.length);
  };

  // Drop handler
  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    const value = e.dataTransfer.getData("value");
    if (!certificateRef.current) return;
    const rect = certificateRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.round(e.clientX - rect.left));
    const y = Math.max(0, Math.round(e.clientY - rect.top));

    if (type === "template") {
      // setTemplate(value);
      setTemplate(`${API_PATH}/uploads/${value}`);
      return;
    }

    if (type === "photo") {
      const newEl = {
        id: Date.now(),
        type: "photo",
        // src: value,
        src: `${API_PATH}/uploads/${value}`,
        x,
        y,
        width: 120,
        height: 120,
        rotate: 0,
        ref: React.createRef(),
      };
      setElements((prev) => [...prev, newEl]);
      setSelectedIndex(elements.length);
      return;
    }

    if (type === "variable") {
      const newEl = {
        id: Date.now(),
        type: "text",
        value: `#${value}#`,
        fontSize: 24,
        color: "#000",
        fontStyle: "normal",
        fontFamily: "sans-serif",
        letterSpacing: 0,
        x,
        y,
        rotate: 0,
        ref: React.createRef(),
      };
      setElements((prev) => [...prev, newEl]);
      setSelectedIndex(elements.length);
      return;
    }
  };

  // Generate HTML
  const generateCertificateHTML = () => {
    const elementHTML = elements
      .map((el) => {
        if (el.type === "photo") {
          return `<div class="element" style="position:absolute; left:${
            el.x
          }px; top:${el.y}px; width:${el.width}px; height:${
            el.height
          }px; transform: rotate(${
            el.rotate || 0
          }deg); z-index: ${10};"><img src="${
            el.src
          }" class="photo" style="width:100%;height:100%;object-fit:cover;border-radius:0;"/></div>`;
        }
        const safeText = String(el.value)
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<div class="element" style="position:absolute; left:${
          el.x
        }px; top:${el.y}px; transform: rotate(${
          el.rotate || 0
        }deg); font-size:${el.fontSize}px; color:${el.color}; font-style:${
          el.fontStyle === "italic" ? "italic" : "normal"
        }; font-weight:${
          el.fontStyle === "bold" ? "bold" : "normal"
        }; font-family: ${el.fontFamily}; letter-spacing:${
          el.letterSpacing
        }px; white-space: pre-wrap;">${safeText}</div>`;
      })
      .join("\n");

    const replacedTemplateImg = template
      ? `<img src="${template}" class="template" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"/>`
      : "";

    return `
    <!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Certificate</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Dancing+Script&family=Pacifico&family=Playfair+Display&family=Roboto&family=Lora&family=Cinzel&family=Merriweather&family=Satisfy&display=swap');
  body { margin: 0; padding: 24px; background: #f3f4f6; font-family: sans-serif; }
  .certificate-wrapper { display:flex; align-items:center; justify-content:center; }
  .certificate { position: relative; width: 1000px; max-width: 100%; aspect-ratio: 10 / 7; background: white; overflow: hidden; }
  .certificate img.template { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .certificate .element { position: absolute; white-space: pre-wrap; }
  .certificate .photo { width:100%;height:100%;display:block; }
</style>
</head>
<body>
  <div class="certificate-wrapper">
    <div class="certificate">
      ${replacedTemplateImg}
      ${elementHTML}
    </div>
  </div>
</body>
</html>

`;
  };

  const handleSave = async (title) => {
    const htmlContent = generateCertificateHTML();

    try {
      const res = await axios.post(
        `${API_PATH}/api/Certificate_Template`,
        {
          id: null,
          title: title,
          templatetext: htmlContent,
          createdby: "admin",
          createdon: "",
        },
        {
          params: {
            APIKEY: API_KEY,
          },
        }
      );
      console.log(res);

      if (res.status === 200 || res.status === 201) {
        alert("Template uploaded successfully!");
      } else {
        alert("Something went wrong. Please try again.");
      }
    } catch (error) {
      console.log(error);
      alert("Failed to upload template!");
    }
  };

  // Remove element
  const removeElement = (id) => {
    setElements((prev) => {
      const next = prev.filter((p) => p.id !== id);
      // clear selection if selected removed
      if (selectedIndex !== null) {
        const sel = prev[selectedIndex];
        if (sel && sel.id === id) setSelectedIndex(null);
      }
      return next;
    });
  };

  // Text change handler
  const handleTextChange = (id, prop, value) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, [prop]: value } : el))
    );
  };

  // const handleDrag = ({ target, left, top }) => {
  //   if (!certificateRef.current) return;

  //   const containerWidth = certificateRef.current.offsetWidth;
  //   const containerHeight = certificateRef.current.offsetHeight;

  //   setElements((prev) =>
  //     prev.map((el, idx) => {
  //       if (idx !== selectedIndex) return el;

  //       const next = { ...el };

  //       let newX = Math.round(left);
  //       let newY = Math.round(top);

  //       // Keep inside LEFT/TOP
  //       if (newX < 0) newX = 0;
  //       if (newY < 0) newY = 0;

  //       // Keep inside RIGHT/BOTTOM
  //       if (newX + el.width > containerWidth) newX = containerWidth - el.width;
  //       if (newY + el.height > containerHeight)
  //         newY = containerHeight - el.height;

  //       next.x = newX;
  //       next.y = newY;

  //       return next;
  //     })
  //   );
  // };

  // 1) Keep the starting x/y/size for the active resize
  const resizeStartRef = useRef(null);

  // const handleResizeStart = () => {
  //   const el = elements[selectedIndex];
  //   if (!el || el.type !== "photo") return;
  //   resizeStartRef.current = {
  //     startX: el.x || 0,
  //     startY: el.y || 0,
  //     startW: el.width || 0,
  //     startH: el.height || 0,
  //   };
  // };

  // 2) Use start + beforeTranslate (no cumulative add!)
  // const handleResize = ({ width, height, drag }) => {
  //   const dx = drag?.beforeTranslate?.[0] || 0;
  //   const dy = drag?.beforeTranslate?.[1] || 0;

  //   setElements((prev) =>
  //     prev.map((el, idx) => {
  //       if (idx !== selectedIndex) return el;
  //       if (el.type !== "photo") return el; // ✅ only photos

  //       const start = resizeStartRef.current || {
  //         startX: el.x || 0,
  //         startY: el.y || 0,
  //       };

  //       return {
  //         ...el,
  //         width: Math.round(width),
  //         height: Math.round(height),
  //         x: Math.round(start.startX + dx),
  //         y: Math.round(start.startY + dy),
  //       };
  //     })
  //   );
  // };

  //   const handleResize = ({ width, height, drag }) => {
  //   if (!certificateRef.current) return;

  //   const containerWidth = certificateRef.current.offsetWidth;
  //   const containerHeight = certificateRef.current.offsetHeight;

  //   const dx = drag?.beforeTranslate?.[0] || 0;
  //   const dy = drag?.beforeTranslate?.[1] || 0;

  //   setElements((prev) =>
  //     prev.map((el, idx) => {
  //       if (idx !== selectedIndex) return el;
  //       if (el.type !== "photo") return el;

  //       const start = resizeStartRef.current || {
  //         startX: el.x || 0,
  //         startY: el.y || 0,
  //       };

  //       let newX = Math.round(start.startX + dx);
  //       let newY = Math.round(start.startY + dy);
  //       let newW = Math.round(width);
  //       let newH = Math.round(height);

  //       // 🔒 Clamp inside container
  //       if (newX < 0) {
  //         newW += newX; // shrink width
  //         newX = 0;
  //       }
  //       if (newY < 0) {
  //         newH += newY; // shrink height
  //         newY = 0;
  //       }
  //       if (newX + newW > containerWidth) {
  //         newW = containerWidth - newX;
  //       }
  //       if (newY + newH > containerHeight) {
  //         newH = containerHeight - newY;
  //       }

  //       // Minimum size safeguard
  //       newW = Math.max(20, newW);
  //       newH = Math.max(20, newH);

  //       return {
  //         ...el,
  //         width: newW,
  //         height: newH,
  //         x: newX,
  //         y: newY,
  //       };
  //     })
  //   );
  // };

  // const handleRotate = ({ beforeRotate }) => {
  //   setElements((prev) =>
  //     prev.map((el, idx) =>
  //       idx === selectedIndex ? { ...el, rotate: Math.round(beforeRotate) } : el
  //     )
  //   );
  // };

  const getPhotoGallery = async () => {
    try {
      const res = await axios.post(
        `${API_PATH}/api/Gallery_Image`,
        {}, // request body (empty in this case)
        { params: { APIKEY: API_KEY } } // query params
      );
      setPhotoGallery(res?.data || []);
    } catch (err) {
      console.error("Error fetching photo gallery:", err);
    }
  };

  const getTemplateGallery = async () => {
    try {
      const res = await axios.post(
        `${API_PATH}/api/Gallery_Image`,
        {}, // request body (empty in this case)
        { params: { APIKEY: API_KEY } } // query params
      );
      setTemplateGallery(res?.data || []);
    } catch (err) {
      console.error("Error fetching template gallery:", err);
    }
  };

  const fetchVariableLists = async () => {
    try {
      const res = await axios.get(`${API_PATH}/api/certificate_variables`, {
        params: {
          APIKEY: API_KEY,
          searchtext: "kjhu",
        },
      });
      setVariablesList(res?.data?.Data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchVariableLists();
  }, []);

  const handleAddVariable = async () => {
    try {
      const res = await axios.post(
        `${API_PATH}/api/gallery_variables`,
        {
          variable: variableName,
          createdon: "2025-08-20T08:15:18.334Z",
          createdby: "Admin",
        },
        {
          params: {
            APIKEY: API_KEY,
          },
        }
      );
      console.log(res?.data);
      await fetchVariableLists();
    } catch (error) {
      console.log(error);
    }
  };
  // ==========================================

  const handleDragStart = ({ target }) => {
    if (selectedIndex == null) return;
    const el = elements[selectedIndex];
    if (!el) return;

    transientRef.current[el.id] = {
      startX: el.x,
      startY: el.y,
      tx: 0,
      ty: 0,
      startW: el.width ?? 0,
      startH: el.height ?? 0,
      startRotate: el.rotate ?? 0,
    };

    // ensure the element is positioned by transform during gesture
    target.style.willChange = "transform";
  };

  // const handleDrag = ({ target, beforeTranslate }) => {
  //   if (selectedIndex == null) return;
  //   const el = elements[selectedIndex];
  //   if (!el) return;

  //   // just visually move; do NOT set state here
  //   const [tx, ty] = beforeTranslate;
  //   const t = transientRef.current[el.id];
  //   if (t) {
  //     t.tx = tx;
  //     t.ty = ty;
  //   }
  //   target.style.transform = `translate(${tx}px, ${ty}px) rotate(${
  //     (t?.startRotate ?? el.rotate) || 0
  //   }deg)`;
  // };
  const handleDrag = ({ target, beforeTranslate }) => {
    if (selectedIndex == null) return;
    const el = elements[selectedIndex];
    if (!el || !certificateRef.current) return;

    const t = transientRef.current[el.id];
    if (!t) return;

    const [txRaw, tyRaw] = beforeTranslate;

    // compute proposed absolute top/left
    const proposedLeft = t.startX + txRaw;
    const proposedTop = t.startY + tyRaw;

    const canvas = getCanvasRect();
    const { w: elW, h: elH } = getElementSize(el, target);

    // NOTE: this bounds ignores rotation for simplicity. Works well in most UIs.
    const minLeft = 0;
    const minTop = 0;
    const maxLeft = Math.max(0, canvas.width - elW);
    const maxTop = Math.max(0, canvas.height - elH);

    const clampedLeft = clamp(proposedLeft, minLeft, maxLeft);
    const clampedTop = clamp(proposedTop, minTop, maxTop);

    const tx = clampedLeft - t.startX;
    const ty = clampedTop - t.startY;

    t.tx = tx;
    t.ty = ty;

    target.style.transform = `translate(${tx}px, ${ty}px) rotate(${
      t.startRotate ?? el.rotate ?? 0
    }deg)`;
  };

  const handleDragEnd = () => {
    if (selectedIndex == null) return;
    const el = elements[selectedIndex];
    const t = transientRef.current[el.id];
    if (!t) return;

    // commit to state: new absolute x/y
    setElements((prev) =>
      prev.map((itm, i) =>
        i === selectedIndex
          ? {
              ...itm,
              x: Math.round(t.startX + t.tx),
              y: Math.round(t.startY + t.ty),
            }
          : itm
      )
    );

    // cleanup inline transform; next gesture starts from clean top/left
    if (el.ref.current) {
      el.ref.current.style.transform = `rotate(${t.startRotate}deg)`;
      el.ref.current.style.willChange = "";
    }
    delete transientRef.current[el.id];
  };

  const handleResizeStart = ({ target }) => {
    if (selectedIndex == null) return;
    const el = elements[selectedIndex];
    if (!el) return;

    transientRef.current[el.id] = {
      startX: el.x,
      startY: el.y,
      tx: 0,
      ty: 0,
      startW: el.width || target.getBoundingClientRect().width,
      startH: el.height || target.getBoundingClientRect().height,
      startRotate: el.rotate ?? 0,
      startFont: el.fontSize ?? 16,
    };

    target.style.willChange = "transform,width,height";
  };

  // const handleResize = ({ target, width, height, drag }) => {
  //   if (selectedIndex == null) return;
  //   const el = elements[selectedIndex];
  //   if (!el) return;

  //   const t = transientRef.current[el.id];
  //   const [tx, ty] = drag.beforeTranslate;

  //   // VISUAL ONLY: set size and transform
  //   target.style.width = `${Math.max(10, Math.round(width))}px`;
  //   target.style.height = `${Math.max(10, Math.round(height))}px`;
  //   target.style.transform = `translate(${tx}px, ${ty}px) rotate(${
  //     t?.startRotate ?? 0
  //   }deg)`;

  //   if (el.type === "text" && t) {
  //     const ratio = t.startH ? height / t.startH : 1;
  //     const scaled = Math.max(6, Math.round((t.startFont || 16) * ratio));
  //     // live preview of font size during gesture
  //     target.style.fontSize = `${scaled}px`;
  //   }

  //   if (t) {
  //     t.tx = tx;
  //     t.ty = ty;
  //   }
  // };
  const handleResize = ({ target, width, height, drag }) => {
    if (selectedIndex == null) return;
    const el = elements[selectedIndex];
    if (!el || !certificateRef.current) return;

    const t = transientRef.current[el.id];
    if (!t) return;

    const canvas = getCanvasRect();

    // desired position during resize (Moveable gives translation)
    let [tx, ty] = drag.beforeTranslate;

    // Original absolute
    const absLeftStart = t.startX;
    const absTopStart = t.startY;

    // Clamp width/height so the box never exceeds canvas
    let W = Math.max(10, Math.round(width));
    let H = Math.max(10, Math.round(height));

    // First clamp translation so top/left >= 0
    let absLeft = absLeftStart + tx;
    let absTop = absTopStart + ty;

    if (absLeft < 0) {
      tx -= absLeft; // move back in
      absLeft = 0;
    }
    if (absTop < 0) {
      ty -= absTop;
      absTop = 0;
    }

    // Then clamp size so right/bottom <= canvas
    const maxW = canvas.width - absLeft;
    const maxH = canvas.height - absTop;
    if (W > maxW) W = maxW;
    if (H > maxH) H = maxH;

    // VISUAL set size and transform
    target.style.width = `${W}px`;
    target.style.height = `${H}px`;
    target.style.transform = `translate(${tx}px, ${ty}px) rotate(${
      t.startRotate ?? 0
    }deg)`;

    // live text font scaling
    if (el.type === "text" && t.startH) {
      const ratio = H / t.startH;
      const scaled = Math.max(6, Math.round((t.startFont || 16) * ratio));
      target.style.fontSize = `${scaled}px`;
    }

    // store transient
    t.tx = tx;
    t.ty = ty;
  };

  const handleResizeEnd = ({ target }) => {
    if (selectedIndex == null) return;
    const el = elements[selectedIndex];
    const t = transientRef.current[el.id];
    if (!t) return;

    setElements((prev) =>
      prev.map((itm, i) => {
        if (i !== selectedIndex) return itm;

        if (itm.type === "photo") {
          const rect = target.getBoundingClientRect();
          return {
            ...itm,
            x: Math.round(t.startX + t.tx),
            y: Math.round(t.startY + t.ty),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        } else {
          // commit text x/y + computed font size
          const rect = target.getBoundingClientRect();
          // read back live font size
          const computed =
            parseInt(getComputedStyle(target).fontSize, 10) ||
            itm.fontSize ||
            16;
          return {
            ...itm,
            x: Math.round(t.startX + t.tx),
            y: Math.round(t.startY + t.ty),
            fontSize: computed,
            // optional: store width/height if you want a bounding box
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }
      })
    );

    // clean inline styles
    target.style.transform = `rotate(${t.startRotate || 0}deg)`;
    target.style.willChange = "";
    // text preview fontSize can remain; React state will re-render it anyway

    delete transientRef.current[el.id];
  };

  const handleRotateStart = () => {
    if (selectedIndex == null) return;
    const el = elements[selectedIndex];
    if (!el) return;
    transientRef.current[el.id] = {
      ...(transientRef.current[el.id] || {}),
      startRotate: el.rotate ?? 0,
    };
  };

  const handleRotate = ({ target, beforeRotate }) => {
    // live rotation preview only
    target.style.transform = `rotate(${beforeRotate}deg)`;
  };

  const handleRotateEnd = ({ beforeRotate, target }) => {
    if (selectedIndex == null) return;
    setElements((prev) =>
      prev.map((el, i) =>
        i === selectedIndex ? { ...el, rotate: beforeRotate } : el
      )
    );
    target.style.transform = `rotate(${beforeRotate}deg)`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans p-4 sm:p-4">
      <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden rounded-xl">
        {/* Sidebar */}
        <aside
          className={`w-full lg:w-[400px] bg-white p-2 rounded-xl  ${
            previewMode ? "hidden" : ""
          }`}
        >
          <h2 className="text-lg font-semibold mb-2 text-gray-700">
            🛠️ Controls
          </h2>

          <div className="space-y-4 text-sm max-h-[88vh] overflow-y-auto ">
            {/* Templates gallery */}
            <div>
              <label className="block font-medium mb-1">Upload Template</label>
              <input
                id="template"
                type="file"
                accept="image/*"
                onChange={handleTemplatePhotoUpload}
                className="w-full border rounded px-2 py-1 cursor-pointer bg-gray-200"
              />
              <p className="mt-2 text-xs text-gray-500">
                Uploaded templates are saved to the gallery. Drag one into the
                canvas to set as background.
              </p>

              <div className="grid grid-cols-3 gap-2 mt-3 max-h-44 overflow-y-auto">
                {templateFiles.length > 0 ? (
                  templateFiles.map((file, idx) => (
                    <img
                      key={`template-${idx}`}
                      src={`${API_PATH}/uploads/${file?.img_path}`}
                      alt={`Template ${idx}`}
                      draggable
                      onDragStart={(e) =>
                        onDragStartTemplate(e, file?.img_path)
                      }
                      onClick={() =>
                        setTemplate(`${API_PATH}/uploads/${file?.img_path}`)
                      }
                      className="cursor-pointer rounded border hover:ring-1 hover:ring-blue-400 w-full h-20 object-cover"
                    />
                  ))
                ) : (
                  <div className="text-gray-400 text-xs">No templates yet</div>
                )}
              </div>
            </div>

            {/* Photo gallery */}
            <div>
              <label className="block font-medium mb-1">Upload Photo</label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                onChange={handleTemplatePhotoUpload}
                className="w-full border rounded px-2 py-1 cursor-pointer bg-gray-200"
              />
              <p className="mt-2 text-xs text-gray-500">
                Photos are saved to the gallery. Drag into canvas to add as an
                image element.
              </p>

              <div className="grid grid-cols-4 gap-2 mt-3 max-h-44 overflow-y-auto">
                {photoFiles.length > 0 ? (
                  photoFiles.map((file, idx) => (
                    <img
                      key={`photo-${idx}`}
                      src={`${API_PATH}/uploads/${file?.img_path}`}
                      alt={`Photo ${idx}`}
                      draggable
                      onDragStart={(e) => onDragStartPhoto(e, file?.img_path)}
                      onClick={() => addPhotoToCanvas(file?.img_path)}
                      className="cursor-pointer rounded border hover:ring-1 hover:ring-blue-400 w-full h-20 object-cover"
                    />
                  ))
                ) : (
                  <div className="text-gray-400 text-xs">No photos yet</div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={addTextField}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded cursor-pointer"
              >
                ➕ Add Text
              </button>
              <button
                onClick={() => setElements([])}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded cursor-pointer"
              >
                Clear Elements
              </button>
            </div>

            {/* Variables */}
            <div>
              <label className="block font-medium mb-1">Add Variable</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="VariableName"
                  value={variableName}
                  onChange={(e) => setVariableName(e.target.value)}
                  className="flex-1 border rounded px-2 py-1"
                />
                <button
                  onClick={handleAddVariable}
                  // onClick={addVariableField}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 rounded cursor-pointer"
                >
                  ➕
                </button>
              </div>

              <div className="mt-2">
                <label className="block font-medium mb-1 mt-2">
                  Variables (drag into canvas)
                </label>
                {variablesList.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No variables added yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto ">
                    {variablesList.map((v) => (
                      <div
                        key={v.id}
                        draggable
                        onDragStart={(e) => onDragStartVariable(e, v.variable)}
                        onClick={() => addVariableToCanvas(v.variable)}
                        className="bg-gray-200 px-2 py-1 rounded text-xs cursor-pointer hover:ring-1 hover:ring-blue-400"
                      >
                        #{v.variable}#
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Elements controls (text editors) */}
            <div>
              <h3 className="font-semibold mb-2">Elements</h3>
              {elements.length === 0 ? (
                <p className="text-xs text-gray-500">No elements on canvas.</p>
              ) : (
                <div className="space-y-3">
                  {elements.map((el, idx) => (
                    <div
                      key={el.id}
                      className={`border p-3 rounded ${
                        selectedIndex === idx ? "ring-2 ring-blue-300" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <strong className="text-sm">
                          {el.type === "photo"
                            ? `Photo ${idx + 1}`
                            : `Text ${idx + 1}`}
                        </strong>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedIndex(idx);
                            }}
                            className="text-sm px-2 py-1 border rounded cursor-pointer"
                          >
                            Select
                          </button>
                          <button
                            onClick={() => removeElement(el.id)}
                            className="text-sm px-2 py-1 border rounded text-red-600 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {el.type === "text" && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {/* Multi-line text input */}
                          <textarea
                            className="border px-2 py-1 rounded text-sm col-span-2 resize-none"
                            rows={3}
                            value={el.value}
                            onChange={(e) =>
                              handleTextChange(el.id, "value", e.target.value)
                            }
                            placeholder="Enter your text here..."
                          />

                          {/* Font Size */}
                          <input
                            type="number"
                            className="border px-2 py-1 rounded text-sm"
                            value={el.fontSize}
                            onChange={(e) =>
                              handleTextChange(
                                el.id,
                                "fontSize",
                                parseInt(e.target.value) || 1
                              )
                            }
                          />

                          {/* Color Picker */}
                          <input
                            type="color"
                            className="border px-2 py-1 rounded cursor-pointer"
                            value={el.color}
                            onChange={(e) =>
                              handleTextChange(el.id, "color", e.target.value)
                            }
                          />

                          {/* Font Family */}
                          <select
                            className="border px-2 py-1 rounded cursor-pointer"
                            value={el.fontFamily}
                            onChange={(e) =>
                              handleTextChange(
                                el.id,
                                "fontFamily",
                                e.target.value
                              )
                            }
                          >
                            {fontOptions.map((f, i) => (
                              <option
                                key={i}
                                value={f}
                                style={{ fontFamily: f }}
                              >
                                {f.replace(/['"]+/g, "")}
                              </option>
                            ))}
                          </select>

                          {/* Font Style */}
                          <select
                            className="border px-2 py-1 rounded cursor-pointer"
                            value={el.fontStyle}
                            onChange={(e) =>
                              handleTextChange(
                                el.id,
                                "fontStyle",
                                e.target.value
                              )
                            }
                          >
                            <option value="normal">Normal</option>
                            <option value="italic">Italic</option>
                            <option value="bold">Bold</option>
                          </select>

                          {/* Letter Spacing */}
                          <input
                            type="number"
                            className="border px-2 py-1 rounded text-sm cursor-pointer"
                            value={el.letterSpacing}
                            onChange={(e) =>
                              handleTextChange(
                                el.id,
                                "letterSpacing",
                                parseInt(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Canvas area */}

        <div className="flex flex-col h-full w-full bg-white shadow-md rounded-xl">
          <main className="flex-1 bg-white p-4 flex items-center justify-center rounded-xl">
            <div
              ref={certificateRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="w-full max-w-full sm:max-w-[700px] md:max-w-[900px] lg:max-w-[1000px] aspect-[10/6.5] mx-auto border border-gray-300 bg-white shadow relative select-none"
            >
              {template ? (
                <img
                  src={template}
                  alt="Template"
                  // className="absolute inset-0 w-full h-full object-cover"
                  className="absolute inset-0 w-full h-full object-fill"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                  Please upload or select a certificate template
                </div>
              )}

              {elements.map((el, index) => (
                <div
                  key={el.id}
                  ref={el.ref}
                  onClick={() => setSelectedIndex(index)}
                  tabIndex={0}
                  className="element"
                  style={{
                    position: "absolute",
                    top: el.y,
                    left: el.x,
                    transform: `rotate(${el.rotate || 0}deg)`,
                    cursor: previewMode ? "default" : "move",
                    zIndex: index + 10,
                    ...(el.type === "photo"
                      ? { width: el.width, height: el.height }
                      : {
                          fontSize: `${el.fontSize}px`,
                          color: el.color,
                          fontStyle:
                            el.fontStyle === "italic" ? "italic" : "normal",
                          fontWeight:
                            el.fontStyle === "bold" ? "bold" : "normal",
                          fontFamily: el.fontFamily,
                          letterSpacing: `${el.letterSpacing}px`,
                          whiteSpace: "pre-wrap",
                        }),
                  }}
                >
                  {el.type === "photo" ? (
                    <img
                      src={el.src}
                      alt="Uploaded"
                      className="photo"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    />
                  ) : (
                    el.value
                  )}
                </div>
              ))}
              {!previewMode &&
                selectedIndex !== null &&
                targets[selectedIndex] && (
                  // <Moveable
                  //   target={targets[selectedIndex]}
                  //   draggable
                  //   resizable={["photo", "text"].includes(
                  //     elements[selectedIndex]?.type
                  //   )}
                  //   rotatable
                  //   edge={false}
                  //   throttleDrag={0}
                  //   throttleResize={0}
                  //   throttleRotate={0}
                  //   onDrag={handleDrag}
                  //   onResizeStart={handleResizeStart}
                  //   onResize={handleResize}
                  //   onRotate={handleRotate}
                  // />

                  <Moveable
                    target={targets[selectedIndex]}
                    draggable
                    resizable={["photo", "text"].includes(
                      elements[selectedIndex]?.type
                    )}
                    rotatable
                    origin={false}
                    snappable
                    snapCenter
                    snapHorizontal
                    snapVertical
                    snapThreshold={8}
                    elementGuidelines={[certificateRef]}
                    // jitter-free handlers
                    onDragStart={handleDragStart}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                    onResizeStart={handleResizeStart}
                    onResize={handleResize}
                    onResizeEnd={handleResizeEnd}
                    onRotateStart={handleRotateStart}
                    onRotate={handleRotate}
                    onRotateEnd={handleRotateEnd}
                    bounds={{
                      left: 0,
                      top: 0,
                      right: certificateRef.current?.clientWidth ?? 0,
                      bottom: certificateRef.current?.clientHeight ?? 0,
                    }}
                    rootContainer={certificateRef.current}
                  />
                )}
            </div>
          </main>

          {/* Buttons row  */}
          <div className="flex justify-around gap-4 mb-2 py-2 px-4">
            <CertificatePopup
              onSave={handleSave}
              kk={
                "flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded transition cursor-pointer"
              }
            />
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded transition cursor-pointer"
            >
              {previewMode ? "👁️ Exit Preview" : "👁️ Preview Mode"}
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "⚠️ This will remove all elements, variables, and reset the template. Continue?"
                  )
                ) {
                  setElements([]);
                  // setVariables([]);
                  // setTemplate(templateGallery[0] || "");
                  setTemplate(null);
                  setSelectedIndex(null);
                  try {
                    localStorage.removeItem("cert-elements");
                    localStorage.removeItem("cert-variables");
                    localStorage.setItem(
                      "cert-template",
                      templateGallery[0] || ""
                    );
                  } catch (e) {}
                  // alert("🧹 All data cleared!");
                }
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded transition font-bold cursor-pointer"
            >
              🧹 Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
