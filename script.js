import { WebsimSocket } from '@websim/websim-socket';

const room = new WebsimSocket();

// DOM Elements
const webcamVideo = document.getElementById('webcam-video');
const webcamCanvas = document.getElementById('webcam-canvas');
const imagePreview = document.getElementById('image-preview');
const previewPlaceholder = document.getElementById('preview-placeholder');
const outputPlaceholder = document.getElementById('output-placeholder');
const startWebcamBtn = document.getElementById('start-webcam-btn');
const capturePhotoBtn = document.getElementById('capture-photo-btn');
const toggleCameraBtn = document.getElementById('toggle-camera-btn');
const uploadBtn = document.getElementById('upload-btn');
const generateBtn = document.getElementById('generate-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const resultImage = document.getElementById('result-image');
const promptContainer = document.getElementById('prompt-container');
const promptText = document.getElementById('prompt-text');
const shareContainer = document.getElementById('share-container');
const shareBtn = document.getElementById('share-btn');
const downloadBtn = document.getElementById('download-btn');
const includePortraitCheckbox = document.getElementById('include-portrait-checkbox');
const galleryGrid = document.getElementById('gallery-grid');
const modal = document.getElementById('gallery-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalPlushieImg = document.getElementById('modal-plushie-img');
const modalOriginalLink = document.getElementById('modal-original-link');
const modalOriginalImg = document.getElementById('modal-original-img');
const modalCreator = document.getElementById('modal-creator');
const modalStyle = document.getElementById('modal-style');
const modalMaterial = document.getElementById('modal-material');
const modalPromptText = document.getElementById('modal-prompt-text');
const modalDownloadBtn = document.getElementById('modal-download-btn');

let imageDataUrl = null;
let lastGeneratedData = {};
let mediaStream = null;
let currentFacingMode = 'user'; // 'user' for front, 'environment' for back
let galleryData = [];

// Helper to convert data URL to a File object
async function dataUrlToFile(dataUrl, fileName) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: 'image/png' });
}

// --- Webcam Functions ---
async function startWebcam(facingMode) {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: facingMode
        }
    };

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamVideo.srcObject = mediaStream;
        webcamVideo.style.display = 'block';
        imagePreview.style.display = 'none';
        previewPlaceholder.style.display = 'none';
        startWebcamBtn.classList.add('hidden');
        capturePhotoBtn.classList.remove('hidden');
        toggleCameraBtn.classList.remove('hidden');
    } catch (err) {
        console.error(`Error accessing webcam with facingMode ${facingMode}:`, err);
        if (facingMode === 'environment') {
            alert("Could not access back camera. Trying front camera.");
            currentFacingMode = 'user';
            await startWebcam('user'); 
        } else {
            alert("Could not access webcam. Please check permissions.");
            stopWebcam();
        }
    }
}

function stopWebcam() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    webcamVideo.style.display = 'none';
    capturePhotoBtn.classList.add('hidden');
    toggleCameraBtn.classList.add('hidden');
    startWebcamBtn.classList.remove('hidden');
}

startWebcamBtn.addEventListener('click', () => {
    startWebcam(currentFacingMode);
});

toggleCameraBtn.addEventListener('click', () => {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    startWebcam(currentFacingMode);
});

capturePhotoBtn.addEventListener('click', () => {
    webcamCanvas.width = webcamVideo.videoWidth;
    webcamCanvas.height = webcamVideo.videoHeight;
    const context = webcamCanvas.getContext('2d');
    context.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);
    imageDataUrl = webcamCanvas.toDataURL('image/png');
    
    updatePreview(imageDataUrl);
    stopWebcam();
});

// --- File Upload Function ---
uploadBtn.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imageDataUrl = e.target.result;
            updatePreview(imageDataUrl);
        };
        reader.readAsDataURL(file);
    }
});

function updatePreview(dataUrl) {
    imagePreview.src = dataUrl;
    imagePreview.style.display = 'block';
    previewPlaceholder.style.display = 'none';
}

// --- Generation Function ---
generateBtn.addEventListener('click', async () => {
    if (!imageDataUrl) {
        alert("Please upload or capture a photo first!");
        return;
    }

    loadingIndicator.classList.remove('hidden');
    outputPlaceholder.classList.add('hidden');
    resultImage.style.display = 'none';
    promptContainer.classList.add('hidden');
    shareContainer.classList.add('hidden');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        const plushieStyle = document.getElementById('plushie-style').value;
        const plushieMaterial = document.getElementById('plushie-material').value;
        const plushieAccessory = document.getElementById('plushie-accessory').value;
        const includePlushieBackground = document.getElementById('plushie-background-checkbox').checked;
        const userPromptInput = document.getElementById('user-prompt-input').value;

        const analysisCompletion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an expert prompt engineer for an image generation AI that uses a reference image. Your task is to create a prompt that will modify the reference image. The goal is to turn the subject(s) of the reference image into plush toys.
                    
                    Your instructions are:
                    1. Identify all primary subjects in the reference image (e.g., people, animals, objects).
                    2. Construct a short, descriptive prompt that transforms ALL identified subjects into plush toys, according to the user's specified style and material.
                    3. If an accessory is chosen (and is not 'None'), apply it to the main subject(s) where appropriate (e.g., "all wearing cute bowties").
                    4. If the user provides extra details, intelligently merge them into the prompt. For example, if they ask for 'a grumpy expression', add that to the description of the subject.
                    5. Handle the background based on the user's choice:
                        - If 'includePlushieBackground' is 'true', describe the background also being transformed into a plushie-like diorama, made of materials like felt, yarn, and cotton.
                        - If 'includePlushieBackground' is 'false', the prompt should specify a simple, neutral background like "product photography, on a clean white background" to isolate the plushie subjects.
                    
                    Example for multiple subjects and no plushie background: "A cute, chibi-style plush toy of the two people, made of soft yarn, based on the reference image. 3D render, product photography, on a clean white background."
                    Example for single subject with user details and plushie background: "A felt-style plush toy of the dog, wearing a tiny top hat and a monocle, with a grumpy expression. The background is also a diorama made of felt and stitched fabric, based on the reference image."

                    Respond ONLY with a JSON object in the format: { "prompt": "your_generated_prompt_here" }. Do not include any other text or explanation.`,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Generate a prompt to modify a reference image based on these choices:
                            - Style: ${plushieStyle}
                            - Material: ${plushieMaterial}
                            - Accessory: ${plushieAccessory}
                            - Include Plushie Background: ${includePlushieBackground}
                            - User Details: ${userPromptInput || 'None'}`,
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageDataUrl },
                        },
                    ],
                },
            ],
            json: true,
        });

        const result = JSON.parse(analysisCompletion.content);
        const generatedPrompt = result.prompt;
        
        promptText.textContent = generatedPrompt;

        const imageResult = await websim.imageGen({
            prompt: generatedPrompt,
            image_inputs: [ { url: imageDataUrl } ],
            aspect_ratio: "1:1",
        });
        
        lastGeneratedData = {
            generated_plushie_url: imageResult.url,
            original_image_data_url: imageDataUrl,
            prompt: generatedPrompt,
            plushie_style: plushieStyle,
            plushie_material: plushieMaterial,
            plushie_accessory: document.getElementById('plushie-accessory').options[document.getElementById('plushie-accessory').selectedIndex].text,
        };

        resultImage.src = imageResult.url;
        
        resultImage.style.display = 'block';
        promptContainer.classList.remove('hidden');
        shareContainer.classList.remove('hidden');
        document.getElementById('output-panel').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error("Error during generation:", error);
        alert("An error occurred while generating the plushie. Please try again.");
        outputPlaceholder.classList.remove('hidden');
    } finally {
        loadingIndicator.classList.add('hidden');
        generateBtn.disabled = false;
        generateBtn.textContent = '3. Generate Plushie!';
    }
});

// --- Download Functionality ---
function downloadImage(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'plushie.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

downloadBtn.addEventListener('click', () => {
    if (lastGeneratedData.generated_plushie_url) {
        downloadImage(lastGeneratedData.generated_plushie_url, 'plushie.png');
    }
});

// --- Sharing Functionality ---
shareBtn.addEventListener('click', async () => {
    if (!lastGeneratedData.generated_plushie_url) {
        alert("Please generate a plushie first.");
        return;
    }

    shareBtn.disabled = true;
    shareBtn.textContent = 'Sharing...';

    try {
        let originalImageUrl = null;
        if (includePortraitCheckbox.checked && lastGeneratedData.original_image_data_url) {
            const file = await dataUrlToFile(lastGeneratedData.original_image_data_url, 'original.png');
            originalImageUrl = await websim.upload(file);
        }

        await room.collection('plushies_v1').create({
            generated_plushie_url: lastGeneratedData.generated_plushie_url,
            original_image_url: originalImageUrl,
            prompt: lastGeneratedData.prompt,
            plushie_style: lastGeneratedData.plushie_style,
            plushie_material: lastGeneratedData.plushie_material,
            plushie_accessory: lastGeneratedData.plushie_accessory,
        });

        alert("Plushie shared successfully!");
        shareContainer.classList.add('hidden');

    } catch (error) {
        console.error("Error sharing plushie:", error);
        alert("There was an error sharing your plushie. Please try again.");
    } finally {
        shareBtn.disabled = false;
        shareBtn.textContent = 'Share to Gallery';
    }
});

// --- Gallery Rendering ---
function renderGallery(plushies) {
    galleryData = plushies.slice().reverse(); // Store newest first
    galleryGrid.innerHTML = ''; 
    galleryData.forEach((plushie, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.dataset.index = index;

        const img = document.createElement('img');
        img.src = plushie.generated_plushie_url;
        img.alt = `A ${plushie.plushie_style} plushie`;
        img.loading = 'lazy';

        const overlay = document.createElement('div');
        overlay.className = 'gallery-item-overlay';
        overlay.innerHTML = `<strong>${plushie.username}</strong>`;
        
        item.appendChild(img);
        item.appendChild(overlay);

        if (plushie.original_image_url) {
            const thumb = document.createElement('div');
            thumb.className = 'original-portrait-thumb';
            thumb.style.backgroundImage = `url(${plushie.original_image_url})`;
            item.appendChild(thumb);
        }

        galleryGrid.appendChild(item);
    });
}

// --- Modal Logic ---
function openModal(index) {
    const plushie = galleryData[index];
    if (!plushie) return;

    modalPlushieImg.src = plushie.generated_plushie_url;
    modalCreator.textContent = plushie.username || 'Anonymous';
    modalStyle.textContent = plushie.plushie_style || 'N/A';
    modalMaterial.textContent = plushie.plushie_material || 'N/A';
    modalPromptText.textContent = plushie.prompt || 'No prompt available.';

    if (plushie.original_image_url) {
        modalOriginalImg.src = plushie.original_image_url;
        modalOriginalLink.href = plushie.original_image_url;
        modalOriginalLink.classList.remove('hidden');
    } else {
        modalOriginalLink.classList.add('hidden');
    }
    
    // Set up download button for this specific image
    modalDownloadBtn.onclick = () => {
         const filename = `${plushie.username}-${plushie.plushie_style}.png`;
         downloadImage(plushie.generated_plushie_url, filename);
    };

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

galleryGrid.addEventListener('click', (e) => {
    const galleryItem = e.target.closest('.gallery-item');
    if (galleryItem && galleryItem.dataset.index) {
        openModal(parseInt(galleryItem.dataset.index));
    }
});

modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
    }
});

// Subscribe to gallery updates
room.collection('plushies_v1').subscribe(renderGallery);