import { WebsimSocket } from '@websim/websim-socket';

const room = new WebsimSocket();

// View switching
const creatorView = document.getElementById('creator-view');
const galleryView = document.getElementById('gallery-view');
const showCreatorBtn = document.getElementById('show-creator-btn');
const showGalleryBtn = document.getElementById('show-gallery-btn');

// Step navigation
const steps = document.querySelectorAll('.step');
const stepIndicators = document.querySelectorAll('.step-indicator');
const nextToStep2Btn = document.getElementById('next-to-step-2');
const backToStep1Btn = document.getElementById('back-to-step-1');
const startOverBtn = document.getElementById('start-over-btn');

// Drawing elements
const drawingCanvas = document.getElementById('drawing-canvas');
const drawingTools = document.getElementById('drawing-tools');
const colorPicker = document.getElementById('color-picker');
const brushSizeSlider = document.getElementById('brush-size');
const brushBtn = document.getElementById('brush-btn');
const eraserBtn = document.getElementById('eraser-btn');
const clearBtn = document.getElementById('clear-btn');
const blankCanvasBtn = document.getElementById('blank-canvas-btn');
const ctx = drawingCanvas.getContext('2d');
let isDrawing = false;
let isErasing = false;

// Core elements
const webcamVideo = document.getElementById('webcam-video');
const webcamCanvas = document.getElementById('webcam-canvas');
const imagePreview = document.getElementById('image-preview');
const previewPlaceholder = document.getElementById('preview-placeholder');
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

let imageDataUrl = null;
let lastGeneratedData = {};
let mediaStream = null;
let currentFacingMode = 'user'; // 'user' for front, 'environment' for back

// Helper to convert data URL to a File object
async function dataUrlToFile(dataUrl, fileName) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: 'image/png' });
}

// --- View and Step Management ---
function showView(viewToShow) {
    creatorView.classList.add('hidden');
    galleryView.classList.add('hidden');
    showCreatorBtn.classList.remove('active');
    showGalleryBtn.classList.remove('active');

    if (viewToShow === 'creator') {
        creatorView.classList.remove('hidden');
        showCreatorBtn.classList.add('active');
    } else {
        galleryView.classList.remove('hidden');
        showGalleryBtn.classList.add('active');
    }
}

function showStep(stepNumber) {
    steps.forEach(step => step.classList.remove('active'));
    document.getElementById(`step-${stepNumber}`).classList.add('active');

    stepIndicators.forEach(indicator => {
        indicator.classList.remove('active');
        if (parseInt(indicator.dataset.step) <= stepNumber) {
            indicator.classList.add('active');
        }
    });
}

showCreatorBtn.addEventListener('click', () => showView('creator'));
showGalleryBtn.addEventListener('click', () => showView('gallery'));
nextToStep2Btn.addEventListener('click', () => showStep(2));
backToStep1Btn.addEventListener('click', () => showStep(1));
startOverBtn.addEventListener('click', () => {
    // Reset state for a new creation
    imageDataUrl = null;
    updatePreview(null);
    clearCanvas();
    drawingTools.classList.add('hidden');
    resultImage.src = '';
    shareContainer.classList.add('hidden');
    promptContainer.classList.add('hidden');
    document.getElementById('user-prompt-input').value = '';
    showStep(1);
});

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
        // Fallback for devices that don't support facingMode or if one camera is missing
        if (facingMode === 'environment') {
            alert("Could not access back camera. Trying front camera.");
            currentFacingMode = 'user';
            await startWebcam('user'); // Attempt to start with the front camera
        } else {
            alert("Could not access webcam. Please check permissions.");
            // Reset buttons if it fails completely
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
    nextToStep2Btn.disabled = false;

    // Stop webcam and reset buttons
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
            nextToStep2Btn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

function updatePreview(dataUrl) {
    const img = new Image();
    if (dataUrl) {
        img.onload = () => {
            // Match canvas to image dimensions for accurate drawing
            const container = document.getElementById('image-preview-container');
            const aspectRatio = img.width / img.height;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            let newWidth = containerWidth;
            let newHeight = newWidth / aspectRatio;

            if (newHeight > containerHeight) {
                newHeight = containerHeight;
                newWidth = newHeight * aspectRatio;
            }

            drawingCanvas.width = newWidth;
            drawingCanvas.height = newHeight;

            imagePreview.style.width = `${newWidth}px`;
            imagePreview.style.height = `${newHeight}px`;

            imagePreview.src = dataUrl;
            imagePreview.style.display = 'block';
            previewPlaceholder.style.display = 'none';
            drawingTools.classList.remove('hidden');
            clearCanvas(); // Explicitly clear any previous drawings
        };
        img.src = dataUrl;
    } else {
        imagePreview.src = '#';
        imagePreview.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        nextToStep2Btn.disabled = true;
        drawingTools.classList.add('hidden');
    }
}

// --- Drawing Canvas Functions ---

function getPointerPosition(event) {
    const rect = drawingCanvas.getBoundingClientRect();
    const scaleX = drawingCanvas.width / rect.width;
    const scaleY = drawingCanvas.height / rect.height;

    if (event.touches) {
        return {
            x: (event.touches[0].clientX - rect.left) * scaleX,
            y: (event.touches[0].clientY - rect.top) * scaleY
        };
    } else {
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }
}

function startDrawing(e) {
    e.preventDefault();
    isDrawing = true;
    const { x, y } = getPointerPosition(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPointerPosition(e);

    ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : colorPicker.value;
    ctx.lineWidth = brushSizeSlider.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.beginPath();
}

function clearCanvas() {
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
}

// Event Listeners for Drawing
drawingCanvas.addEventListener('mousedown', startDrawing);
drawingCanvas.addEventListener('mousemove', draw);
drawingCanvas.addEventListener('mouseup', stopDrawing);
drawingCanvas.addEventListener('mouseleave', stopDrawing);

drawingCanvas.addEventListener('touchstart', startDrawing);
drawingCanvas.addEventListener('touchmove', draw);
drawingCanvas.addEventListener('touchend', stopDrawing);

clearBtn.addEventListener('click', clearCanvas);

brushBtn.addEventListener('click', () => {
    isErasing = false;
    brushBtn.classList.add('active');
    eraserBtn.classList.remove('active');
});

eraserBtn.addEventListener('click', () => {
    isErasing = true;
    eraserBtn.classList.add('active');
    brushBtn.classList.remove('active');
});

blankCanvasBtn.addEventListener('click', () => {
    // Create a white background image
    const tempCanvas = document.createElement('canvas');
    const container = document.getElementById('image-preview-container');
    tempCanvas.width = container.clientWidth;
    tempCanvas.height = container.clientHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    imageDataUrl = tempCanvas.toDataURL('image/png');
    updatePreview(imageDataUrl);
    clearCanvas();
    nextToStep2Btn.disabled = false;
    stopWebcam();
});

// --- Generation Function ---
async function getCombinedImage() {
    const background = new Image();
    background.src = imageDataUrl;
    
    return new Promise((resolve) => {
        background.onload = () => {
            const combinedCanvas = document.createElement('canvas');
            combinedCanvas.width = background.width;
            combinedCanvas.height = background.height;
            const combinedCtx = combinedCanvas.getContext('2d');

            // Draw original image first
            combinedCtx.drawImage(background, 0, 0);

            // Draw the user's drawing on top, scaling it to match the original image size
            combinedCtx.drawImage(drawingCanvas, 0, 0, background.width, background.height);
            
            resolve(combinedCanvas.toDataURL('image/png'));
        };
    });
}

generateBtn.addEventListener('click', async () => {
    if (!imageDataUrl) {
        alert("Please upload or capture a photo first!");
        return;
    }

    // Go to step 3 and show loading state
    showStep(3);
    loadingIndicator.classList.remove('hidden');
    resultImage.style.display = 'none';
    promptContainer.classList.add('hidden');
    shareContainer.classList.add('hidden');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        const combinedImageDataUrl = await getCombinedImage();

        // Get user selections
        const plushieStyle = document.getElementById('plushie-style').value;
        const plushieMaterial = document.getElementById('plushie-material').value;
        const plushieAccessory = document.getElementById('plushie-accessory').value;
        const includePlushieBackground = document.getElementById('plushie-background-checkbox').checked;
        const userPromptInput = document.getElementById('user-prompt-input').value;

        // 1. AI call to analyze image and create a prompt
        const analysisCompletion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an expert prompt engineer for an image generation AI that uses a reference image. Your task is to create a prompt that will modify the reference image. The goal is to turn the subject(s) of the reference image into plush toys.
                    
                    The user may have drawn on the reference image. Interpret these drawings as direct additions to the plushie's design. For example, drawn-on horns should become plush horns, a drawn-on cape should be a fabric cape, and simple shapes should be interpreted creatively as part of the plushie. If the user draws on a blank canvas, turn their entire drawing into a plushie.
                    
                    Your instructions are:
                    1. Identify all primary subjects in the reference image (e.g., people, animals, objects, or drawings).
                    2. Construct a short, descriptive prompt that transforms ALL identified subjects and drawings into plush toys, according to the user's specified style and material.
                    3. If an accessory is chosen (and is not 'None'), apply it to the main subject(s) where appropriate (e.g., "all wearing cute bowties").
                    4. If the user provides extra details, intelligently merge them into the prompt. For example, if they ask for 'a grumpy expression', add that to the description of the subject.
                    5. Handle the background based on the user's choice:
                        - If 'includePlushieBackground' is 'true', describe the background also being transformed into a plushie-like diorama, made of materials like felt, yarn, and cotton.
                        - If 'includePlushieBackground' is 'false', the prompt should specify a simple, neutral background like "product photography, on a clean white background" to isolate the plushie subjects.
                    
                    Example for multiple subjects and no plushie background: "A cute, chibi-style plush toy of the two people, made of soft yarn, based on the reference image. 3D render, product photography, on a clean white background."
                    Example for single subject with user details and plushie background: "A felt-style plush toy of the dog, wearing a tiny top hat and a monocle, with a grumpy expression. The background is also a diorama made of felt and stitched fabric, based on the reference image."
                    Example with user drawing: "A cute plushie of the cat from the image, with added plushie devil horns as drawn on the image, made from fuzzy fleece."

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
                            image_url: { url: combinedImageDataUrl },
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
                { url: combinedImageDataUrl }
            ],
            aspect_ratio: "1:1",
        });
        
        lastGeneratedData = {
            generated_plushie_url: imageResult.url,
            original_image_data_url: combinedImageDataUrl, // Save the combined image
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
        generateBtn.textContent = 'Generate Plushie!';
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

        alert("Plushie shared successfully! Check it out in the gallery.");
        showView('gallery');
        startOverBtn.click(); // Reset the creator view for next time

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