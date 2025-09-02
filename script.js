import { WebsimSocket } from '@websim/websim-socket';

const room = new WebsimSocket();

const webcamVideo = document.getElementById('webcam-video');
const webcamCanvas = document.getElementById('webcam-canvas');
const imagePreview = document.getElementById('image-preview');
const previewPlaceholder = document.getElementById('preview-placeholder');
const startWebcamBtn = document.getElementById('start-webcam-btn');
const capturePhotoBtn = document.getElementById('capture-photo-btn');
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

let imageDataUrl = null;
let lastGeneratedData = {};

// Helper to convert data URL to a File object
async function dataUrlToFile(dataUrl, fileName) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: 'image/png' });
}

// --- Webcam Functions ---
startWebcamBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamVideo.srcObject = stream;
        webcamVideo.style.display = 'block';
        imagePreview.style.display = 'none';
        previewPlaceholder.style.display = 'none';
        startWebcamBtn.classList.add('hidden');
        capturePhotoBtn.classList.remove('hidden');
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        alert("Could not access webcam. Please check permissions.");
    }
});

capturePhotoBtn.addEventListener('click', () => {
    webcamCanvas.width = webcamVideo.videoWidth;
    webcamCanvas.height = webcamVideo.videoHeight;
    const context = webcamCanvas.getContext('2d');
    context.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);
    imageDataUrl = webcamCanvas.toDataURL('image/png');
    
    updatePreview(imageDataUrl);

    // Stop webcam
    webcamVideo.srcObject.getTracks().forEach(track => track.stop());
    webcamVideo.style.display = 'none';
    capturePhotoBtn.classList.add('hidden');
    startWebcamBtn.classList.remove('hidden');
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

    // Show loading state
    loadingIndicator.classList.remove('hidden');
    resultImage.style.display = 'none';
    promptContainer.classList.add('hidden');
    shareContainer.classList.add('hidden');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        // Get user selections
        const plushieStyle = document.getElementById('plushie-style').value;
        const plushieMaterial = document.getElementById('plushie-material').value;
        const plushieAccessory = document.getElementById('plushie-accessory').value;

        // 1. AI call to analyze image and create a prompt
        const analysisCompletion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an expert prompt engineer for an image generation AI that uses a reference image. Your task is to create a prompt that will modify the reference image. The goal is to turn the subject of the reference image into a plush toy.
                    
                    Given the user's choices for style, material, and accessory, construct a short, descriptive prompt. The prompt should focus on the *transformation* into a plushie.
                    
                    Example: "A cute, chibi-style plush toy of the subject, made of soft yarn, based on the reference image. 3D render, product photography, on a clean white background."
                    
                    If an accessory is chosen (and not 'None'), integrate it naturally into the prompt (e.g., "wearing a cute bowtie").
                    
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
                            - Accessory: ${plushieAccessory}`,
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

        // 2. AI call to generate the image using the new prompt AND the reference image
        const imageResult = await websim.imageGen({
            prompt: generatedPrompt,
            image_inputs: [
                { url: imageDataUrl }
            ],
            aspect_ratio: "1:1",
        });
        
        lastGeneratedData = {
            generated_plushie_url: imageResult.url,
            original_image_data_url: imageDataUrl,
            prompt: generatedPrompt,
            plushie_style: plushieStyle,
            plushie_material: plushieMaterial,
            plushie_accessory: document.getElementById('plushie-accessory').options[document.getElementById('plushie-accessory').selectedIndex].text, // get text label
        };

        resultImage.src = imageResult.url;
        
        // Show result
        resultImage.style.display = 'block';
        promptContainer.classList.remove('hidden');
        shareContainer.classList.remove('hidden');

    } catch (error) {
        console.error("Error during generation:", error);
        alert("An error occurred while generating the plushie. Please try again.");
    } finally {
        // Hide loading state
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
    if (!lastGeneratedData.generated_plushie_url) {
        alert("Please generate a plushie first.");
        return;
    }
    downloadImage(lastGeneratedData.generated_plushie_url, 'plushie.png');
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
    galleryGrid.innerHTML = ''; // Clear existing items
    const reversedPlushies = plushies.slice().reverse(); // Show newest first
    reversedPlushies.forEach(plushie => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const img = document.createElement('img');
        img.src = plushie.generated_plushie_url;
        img.alt = `A ${plushie.plushie_style} plushie`;

        const overlay = document.createElement('div');
        overlay.className = 'gallery-item-overlay';
        overlay.innerHTML = `
            <strong>${plushie.username}</strong>
            <span>${plushie.plushie_style}</span>
            <span>(${plushie.plushie_material})</span>
        `;
        
        item.appendChild(img);
        item.appendChild(overlay);

        // Add click to download
        item.addEventListener('click', () => {
            const filename = `${plushie.username}-${plushie.plushie_style}.png`;
            downloadImage(plushie.generated_plushie_url, filename);
        });

        if (plushie.original_image_url) {
            const thumb = document.createElement('div');
            thumb.className = 'original-portrait-thumb';
            thumb.style.backgroundImage = `url(${plushie.original_image_url})`;
            thumb.title = "Click to view original image";
            thumb.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(plushie.original_image_url, '_blank');
            });
            item.appendChild(thumb);
        }

        galleryGrid.appendChild(item);
    });
}

// Subscribe to gallery updates
room.collection('plushies_v1').subscribe(renderGallery);