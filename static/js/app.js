const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const suggestions = document.querySelector("#suggestions");
const scannerDialog = document.querySelector("#scanner-dialog");
const scannerVideo = document.querySelector("#scanner-video");
const cameraSelect = document.querySelector("#camera-select");
const scanButton = document.querySelector("#scan-button");
const closeScannerButton = document.querySelector("#close-scanner");
const statusElement = document.querySelector("#scanner-status");
const scannerFrame = document.querySelector(".scanner-frame");
const resultCard = document.querySelector("#result-card");
const productCode = document.querySelector("#product-code");
const productName = document.querySelector("#product-name");
const productPrice = document.querySelector("#product-price");

const recentScans = new Map();
const scanCandidates = new Map();
const preferredCameraKey = "consultor-precios-camera-id";
let scanner;
let scannerControls;
let nativeDetectorInterval;
let quaggaFrameInterval;
let quaggaFrameBusy = false;
let searchTimeout;
let audioContext;

function setStatus(message) {
  statusElement.textContent = message;
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  );
}

function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playBeep() {
  unlockAudio();

  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(1040, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.18);
}

function notifyScanDetected(code) {
  playBeep();

  if ("vibrate" in navigator) {
    navigator.vibrate([80, 35, 80]);
  }

  scannerFrame.classList.add("detected");
  setStatus(`Codigo detectado: ${code}`);

  window.setTimeout(() => {
    scannerFrame.classList.remove("detected");
  }, 700);
}

function formatPlu(codigo = "") {
  return `Nombre - PLU ${codigo}`;
}

function showIdle(message = "Busca o escanea un producto") {
  resultCard.className = "result-card idle";
  productCode.textContent = "";
  productName.textContent = `🔎 ${message}`;
  productPrice.textContent = "";
}

function showProduct(product) {
  resultCard.className = "result-card success";
  productCode.textContent = formatPlu(product.codigo);
  productName.textContent = product.nombre;
  productPrice.textContent = product.precio;
}

function showError(message) {
  resultCard.className = "result-card error";
  productCode.textContent = "";
  productName.textContent = `⚠ ${message}`;
  productPrice.textContent = "";
}

function closeSuggestions() {
  suggestions.classList.remove("open");
  suggestions.innerHTML = "";
}

function renderSuggestions(products) {
  suggestions.innerHTML = "";

  if (!products.length) {
    closeSuggestions();
    return;
  }

  products.forEach((product) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "suggestion-item";
    item.setAttribute("role", "option");
    item.textContent = `${product.codigo} - ${product.nombre}`;
    item.addEventListener("click", () => {
      searchInput.value = product.codigo;
      closeSuggestions();
      showProduct(product);
    });
    suggestions.appendChild(item);
  });

  suggestions.classList.add("open");
}

async function searchProducts(term) {
  const query = term.trim();

  if (query.length < 2) {
    closeSuggestions();
    return;
  }

  try {
    const response = await fetch(`/buscar?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      closeSuggestions();
      return;
    }

    renderSuggestions(payload.productos || []);
  } catch (error) {
    closeSuggestions();
  }
}

async function chooseFirstSearchResult(term) {
  const query = term.trim();

  if (query.length < 2) {
    showIdle();
    return;
  }

  try {
    const response = await fetch(`/buscar?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    const firstProduct = payload.productos?.[0];

    if (response.ok && payload.success && firstProduct) {
      searchInput.value = firstProduct.codigo;
      showProduct(firstProduct);
      return;
    }

    showError("Producto no encontrado");
  } catch (error) {
    showError("No fue posible consultar el producto");
  }
}

function canQueryCode(code) {
  const now = Date.now();
  const lastScan = recentScans.get(code) || 0;

  if (now - lastScan < 2000) {
    return false;
  }

  recentScans.set(code, now);
  return true;
}

function normalizeScannedCode(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function hasValidGtinChecksum(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) {
    return true;
  }

  const digits = code.split("").map(Number);
  const checkDigit = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function isGtinCode(code) {
  return /^\d+$/.test(code) && [8, 12, 13].includes(code.length);
}

function isPlausibleScannedCode(code) {
  if (!/^[A-Za-z0-9._-]{4,32}$/.test(code)) {
    return false;
  }

  return hasValidGtinChecksum(code);
}

function isConfirmedScan(code) {
  const requiredReads = isGtinCode(code) && hasValidGtinChecksum(code) ? 1 : 2;
  const now = Date.now();
  const candidate = scanCandidates.get(code);

  if (requiredReads === 1) {
    scanCandidates.clear();
    return true;
  }

  if (!candidate || now - candidate.lastSeen > 1400) {
    scanCandidates.clear();
    scanCandidates.set(code, { count: 1, lastSeen: now });
    setStatus(`Leyendo ${code}...`);
    return false;
  }

  candidate.count += 1;
  candidate.lastSeen = now;

  if (candidate.count < requiredReads) {
    setStatus(`Confirmando ${code}...`);
    return false;
  }

  scanCandidates.clear();
  return true;
}

async function queryProduct(code) {
  const cleanCode = code.trim();

  if (!cleanCode) {
    return;
  }

  try {
    setStatus(`Consultando ${cleanCode}...`);
    const response = await fetch(`/producto/${encodeURIComponent(cleanCode)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();

    if (!response.ok) {
      showError(payload.mensaje || "Error consultando la base de datos.");
      return;
    }

    if (payload.success) {
      searchInput.value = payload.codigo || cleanCode;
      showProduct(payload);
    } else {
      showError(payload.mensaje || "Producto no encontrado");
    }
  } catch (error) {
    showError("No fue posible consultar el producto");
  } finally {
    setStatus("Camara activa. Sigue escaneando.");
  }
}

function getScannerConfig() {
  return {
    delayBetweenScanAttempts: 80,
    delayBetweenScanSuccess: 800,
  };
}

function startNativeDetectorFallback(onScanSuccess) {
  if (!("BarcodeDetector" in window)) {
    return;
  }

  let detector;

  try {
    detector = new BarcodeDetector({
      formats: ["ean_13", "code_128", "qr_code"],
    });
  } catch (error) {
    return;
  }

  nativeDetectorInterval = window.setInterval(async () => {
    const video = document.querySelector("#reader video");

    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    try {
      const barcodes = await detector.detect(video);
      const barcode = barcodes.find((item) => item.rawValue);

      if (barcode) {
        onScanSuccess(barcode.rawValue);
      }
    } catch (error) {
      window.clearInterval(nativeDetectorInterval);
    }
  }, 120);
}

function startQuaggaFrameDecoder(onScanSuccess) {
  if (!window.Quagga) {
    return;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return;
  }

  quaggaFrameInterval = window.setInterval(() => {
    if (quaggaFrameBusy || scannerVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const videoWidth = scannerVideo.videoWidth;
    const videoHeight = scannerVideo.videoHeight;

    if (!videoWidth || !videoHeight) {
      return;
    }

    quaggaFrameBusy = true;

    const cropHeight = Math.floor(videoHeight * 0.58);
    const cropY = Math.floor((videoHeight - cropHeight) / 2);
    canvas.width = Math.min(videoWidth, 960);
    canvas.height = Math.floor((cropHeight / videoWidth) * canvas.width);
    context.drawImage(
      scannerVideo,
      0,
      cropY,
      videoWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    Quagga.decodeSingle(
      {
        locate: true,
        numOfWorkers: 0,
        src: canvas.toDataURL("image/jpeg", 0.82),
        inputStream: {
          size: canvas.width,
        },
        locator: {
          patchSize: "large",
          halfSample: false,
        },
        decoder: {
          readers: ["ean_reader", "code_128_reader"],
          multiple: false,
        },
      },
      (result) => {
        quaggaFrameBusy = false;
        const code = result?.codeResult?.code;

        if (code) {
          onScanSuccess(code);
        }
      }
    );
  }, isIOSDevice() ? 260 : 420);
}

async function getCameraOptions() {
  const cameraOptions = [];

  try {
    const cameras = await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
    const rearCameras = cameras.filter((camera) =>
      /back|rear|environment|trasera|posterior/i.test(camera.label)
    );
    const normalRearCameras = rearCameras.filter(
      (camera) => !/wide|ultra|macro|gran/i.test(camera.label)
    );

    normalRearCameras.forEach((camera) => cameraOptions.push(camera.deviceId));
    rearCameras.forEach((camera) => cameraOptions.push(camera.deviceId));

    cameras.forEach((camera) => {
      cameraOptions.push(camera.deviceId);
    });
  } catch (error) {
    cameraOptions.push(undefined);
  }

  cameraOptions.push(undefined);

  return [...new Set(cameraOptions)];
}

async function getVideoInputDevices() {
  if (!window.ZXingBrowser) {
    return [];
  }

  try {
    return await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
  } catch (error) {
    return [];
  }
}

function describeCamera(camera, index) {
  const label = camera.label || `Camara ${index + 1}`;

  if (/wide|ultra|gran/i.test(label)) {
    return `${label} (gran angular)`;
  }

  if (/macro/i.test(label)) {
    return `${label} (macro)`;
  }

  if (/back|rear|environment|trasera|posterior/i.test(label)) {
    return `${label} (trasera)`;
  }

  return label;
}

async function populateCameraSelect(selectedDeviceId = "") {
  const cameras = await getVideoInputDevices();
  cameraSelect.innerHTML = "";

  if (!cameras.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Camara automatica";
    cameraSelect.appendChild(option);
    cameraSelect.disabled = true;
    return [];
  }

  cameraSelect.disabled = false;
  cameras.forEach((camera, index) => {
    const option = document.createElement("option");
    option.value = camera.deviceId;
    option.textContent = describeCamera(camera, index);
    cameraSelect.appendChild(option);
  });

  const savedDeviceId = selectedDeviceId || localStorage.getItem(preferredCameraKey) || "";
  if (savedDeviceId && cameras.some((camera) => camera.deviceId === savedDeviceId)) {
    cameraSelect.value = savedDeviceId;
  }

  return cameras;
}

function reorderCameraOptions(cameraOptions, preferredDeviceId) {
  if (!preferredDeviceId) {
    return cameraOptions;
  }

  return [
    preferredDeviceId,
    ...cameraOptions.filter((deviceId) => deviceId !== preferredDeviceId),
  ];
}

function clearQuaggaElements() {
  document.querySelectorAll("#reader video:not(#scanner-video), #reader canvas").forEach((element) => {
    element.remove();
  });
}

async function optimizeCurrentVideoTrack() {
  const stream = scannerVideo?.srcObject;
  const track = stream?.getVideoTracks?.()[0];

  if (!track?.applyConstraints) {
    return;
  }

  try {
    await track.applyConstraints({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      advanced: [{ focusMode: "continuous" }],
    });
  } catch (error) {
    try {
      await track.applyConstraints({
        width: { ideal: 1280 },
        height: { ideal: 720 },
      });
    } catch (fallbackError) {
      // La camara ya esta abierta; si no acepta mejoras, seguimos escaneando.
    }
  }
}

async function stopScanner() {
  if (nativeDetectorInterval) {
    window.clearInterval(nativeDetectorInterval);
    nativeDetectorInterval = null;
  }

  if (quaggaFrameInterval) {
    window.clearInterval(quaggaFrameInterval);
    quaggaFrameInterval = null;
    quaggaFrameBusy = false;
  }

  if (scannerControls) {
    scannerControls.stop();
    scannerControls = null;
  }

  clearQuaggaElements();

  const stream = scannerVideo?.srcObject;
  stream?.getTracks?.().forEach((track) => track.stop());
  scannerVideo.srcObject = null;
  scannerVideo.style.display = "";
}

async function startScanner() {
  if (!window.ZXingBrowser && !window.Quagga) {
    showError("No se pudo cargar el lector de codigos.");
    setStatus("Revisa la conexion a internet para cargar el lector.");
    return;
  }

  if (!window.isSecureContext) {
    showIdle("La camara requiere HTTPS");
    setStatus("En celular usa HTTPS. HTTP solo funciona en localhost.");
    return;
  }

  await stopScanner();
  const onScanSuccess = async (decodedText) => {
    const code = normalizeScannedCode(decodedText);

    if (code && isPlausibleScannedCode(code) && isConfirmedScan(code) && canQueryCode(code)) {
      notifyScanDetected(code);
      await queryProduct(code);
      await stopScanner();
      scannerDialog.close();
    }
  };

  if (!window.ZXingBrowser) {
    showError("No se pudo cargar el lector de codigos.");
    setStatus("Revisa la conexion a internet para cargar ZXing.");
    return;
  }

  scanner = new ZXingBrowser.BrowserMultiFormatReader(undefined, getScannerConfig());
  await populateCameraSelect();
  const preferredDeviceId = cameraSelect.value || localStorage.getItem(preferredCameraKey) || "";
  const cameraOptions = reorderCameraOptions(await getCameraOptions(), preferredDeviceId);

  for (const deviceId of cameraOptions) {
    try {
      scannerControls = await scanner.decodeFromVideoDevice(
        deviceId,
        scannerVideo,
        (result) => {
          if (result?.getText) {
            onScanSuccess(result.getText());
          }
        }
      );
      scannerVideo.muted = true;
      scannerVideo.setAttribute("muted", "");
      scannerVideo.setAttribute("playsinline", "");
      scannerVideo.setAttribute("webkit-playsinline", "");
      await scannerVideo.play().catch(() => {});
      await optimizeCurrentVideoTrack();
      startNativeDetectorFallback(onScanSuccess);
      startQuaggaFrameDecoder(onScanSuccess);
      if (deviceId) {
        localStorage.setItem(preferredCameraKey, deviceId);
        cameraSelect.value = deviceId;
      }
      setStatus("Camara activa. Sigue escaneando.");
      return;
    } catch (error) {
      await stopScanner();
    }
  }

  showIdle("Activa el permiso de camara");
  setStatus("No fue posible abrir la camara. Revisa permisos o usa HTTPS.");
}

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(() => {
    searchProducts(searchInput.value);
  }, 250);
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  closeSuggestions();

  if (/^\d+$/.test(searchInput.value.trim())) {
    queryProduct(searchInput.value);
    return;
  }

  chooseFirstSearchResult(searchInput.value);
});

scanButton.addEventListener("click", async () => {
  unlockAudio();
  scannerDialog.showModal();
  setStatus("Preparando camara...");
  await startScanner();
});

closeScannerButton.addEventListener("click", async () => {
  await stopScanner();
  scannerDialog.close();
});

cameraSelect.addEventListener("change", async () => {
  if (!cameraSelect.value) {
    return;
  }

  localStorage.setItem(preferredCameraKey, cameraSelect.value);

  if (scannerDialog.open) {
    setStatus("Cambiando camara...");
    await startScanner();
  }
});

scannerDialog.addEventListener("close", () => {
  stopScanner();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-form")) {
    closeSuggestions();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/static/service-worker.js");
  });
}

window.addEventListener("load", () => {
  showIdle();
  searchInput.focus();
});
