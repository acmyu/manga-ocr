let imgElement = document.getElementById("imageSrc")
let inputElement = document.getElementById("fileInput");
inputElement.addEventListener("change", (e) => {
  imgElement.src = URL.createObjectURL(e.target.files[0]);
}, false);

const DEFAULT_IMG = ""; //"https://i.ibb.co/NVXc4m3/img.jpg";
const DEEPL_KEY = window.localStorage.getItem('dk');

if (DEEPL_KEY != null) {
    document.getElementById("deepl-key").value = DEEPL_KEY;
}

let params = {
    "runTesseract": true,
    "getAdditionalText": true,
    "verboseMode": true,
    "resizeHeight": 1500, // resize the image by height (can be 2-page spread) to keep param tuning consistent
    "binarizationBlocksize": 75, // size of a pixel neighborhood that is used to calculate a threshold value for the pixel. Must be odd number
    "binarizationSubtraction": 3, // constant subtracted from the mean or weighted mean. Larger value = thinner lines
    "erosionKernel": 2, // structuring element used for erosion. Larger = thicker lines
    "erosionIterations": 1, // number of times erosion is applied. 
    "minCntArea": 50,
    "maxCntArea": 0.95,
    "minBubbleArea": 2000,
    "complexitySensitivity": 4,
    "furiganaSensitivity": 6,
    "furiganaWidth": 0.5,
    "deeplKey": "",
    "separateTextTable": false,
}
    
function initParams() {
    params.runTesseract = document.getElementById("run-tesseract").checked;
    params.getAdditionalText = document.getElementById("get-additional-text").checked;
    params.verboseMode = document.getElementById("verbose-mode").checked;
    params.resizeHeight = parseInt(document.getElementById("resize-height").value);
    params.binarizationBlocksize = parseInt(document.getElementById("binarization-blocksize").value);
    if (params.binarizationBlocksize % 2 == 0) {
        params.binarizationBlocksize++;
    }
    params.binarizationSubtraction = parseInt(document.getElementById("binarization-subtraction").value);
    params.erosionKernel = parseInt(document.getElementById("erosion-kernel").value);
    params.erosionIterations = parseInt(document.getElementById("erosion-iterations").value);
    params.minCntArea = parseInt(document.getElementById("min-area").value);
    params.maxCntArea = parseFloat(document.getElementById("max-area").value);
    params.minBubbleArea = parseInt(document.getElementById("min-bubble-area").value);
    params.complexitySensitivity = parseInt(document.getElementById("complexity-sensitivity").value);
    params.furiganaSensitivity = parseInt(document.getElementById("furigana-sensitivity").value);
    params.furiganaWidth = parseFloat(document.getElementById("furigana-width").value);
    //imgElement.src = URL.createObjectURL(defaultImgSrc);
    
    params.deeplKey = document.getElementById("deepl-key").value;
    window.localStorage.setItem('dk', params.deeplKey);

    console.log(params);
}

let canvas = document.getElementById("original");
let ctx = canvas.getContext('2d');
let originalImg = new Image();
function displayOriginalImage(src) {
    originalImg.src = src;
    originalImg.setAttribute('crossOrigin', '');
    //originalImg.width = Math.round(originalImg.width*params.resizeHeight/originalImg.height);
    //originalImg.height = params.resizeHeight;
    originalImg.onload = function() {
        let resizeWidth = Math.round(originalImg.width*params.resizeHeight/originalImg.height);
        canvas.width = resizeWidth;
        canvas.height = params.resizeHeight;
        ctx.drawImage(originalImg, 0, 0, resizeWidth, params.resizeHeight);
    };
}
displayOriginalImage(DEFAULT_IMG);
/*
inputElement.addEventListener('change', (e) => {
    if (e.target.files[0] != undefined) {
        displayOriginalImage(URL.createObjectURL(e.target.files[0]));
    } else {
        displayOriginalImage(DEFAULT_IMG);
    }
}, false);*/

function createOutputCanvas(name, tr) {
    var td = document.createElement("td");
    var canvas=document.createElement("canvas");
    canvas.id=name;
    td.appendChild(canvas);
    tr.appendChild(td);
    return td;
}

function createOutputTable(nContours) {
    var bubblesTable = document.getElementById("bubbles");
    var textTable = document.getElementById("output-text");
    
    if (params.verboseMode) {
        bubblesTable.innerHTML = '<tr><th>Bubble</th><th>Bubble Contents</th><th>Remove Furigana</th><th>OCR (horizontal)</th><th>OCR (vertical)</th><th style="padding: 0px 100px;">Text</th><th style="padding: 0px 100px;">Translated</th></tr>';
    } else {
        bubblesTable.innerHTML = "<tr><th>Bubble</th></tr>";
    }
    if (params.separateTextTable) {
        textTable.innerHTML = "<tr><th>Text</th><th>Translated</th></tr>";
    }

    for (let i = 0; i < nContours; i++) {
        var tr = document.createElement("tr");
        if (params.verboseMode) {
            createOutputCanvas("bubble-"+i, tr);
            createOutputCanvas("bubble-contents-"+i, tr);
        }
        createOutputCanvas("furigana-"+i, tr);
        if (params.verboseMode) {
            createOutputCanvas("ocr-h-"+i, tr).id = "text-h-"+i;
            createOutputCanvas("ocr-v-"+i, tr).id = "text-v-"+i;
        }
        
        var tr2 = document.createElement("tr");
        var ocrTd = document.createElement("td");
        ocrTd.id="text-"+i;
        ocrTd.width = 100;
        tr.appendChild(ocrTd);
        
        var transTd = document.createElement("td");
        transTd.id="trans-"+i;
        tr.appendChild(transTd);
        
        bubblesTable.appendChild(tr);
        
        if (params.separateTextTable) {
            tr2.appendChild(ocrTd);
            tr2.appendChild(transTd);
            textTable.appendChild(tr2);
        }
    }
}

function displayContours(name, in_contours, contours, colors, img) {
    if (!params.verboseMode) {
        return;
    }
    
    let mask = cv.Mat.zeros(img.rows, img.cols, cv.CV_8UC3);
    for (let i = 0; i < in_contours.length; ++i) {
        if (!in_contours[i]) {
            continue;
        }
        cv.drawContours(mask, contours, i, colors[i], 1.5);
    }
    
    let dsize = new cv.Size(Math.round(mask.cols*1000/mask.rows), 1000);
    cv.resize(mask, mask, dsize, 0, 0, cv.INTER_AREA);
    cv.imshow(name, mask);
    mask.delete();
}

function initContourColors(colors) {
    for (let i = 0; i < colors.length; i++) {
        colors[i] = new cv.Scalar(Math.round(Math.random() * 200+55), Math.round(Math.random() * 200+55),
                                  Math.round(Math.random() * 200+55));
    }
}

function hasSiblingDecendent(i, keys, hierarchy, mode) {
    let h = hierarchy.intPtr(0, i);
    let sibling = h[mode];
    while (sibling != -1) {
        if (keys[sibling]){
            return true;
        }
        h = hierarchy.intPtr(0, sibling);
        if (hasDecendent(h[2], keys, hierarchy)) {
            return true;
        }
        sibling = h[mode];
    }
    return false;
}
    
function hasDecendent(child, keys, hierarchy) {
    if (child == -1) {
        return false;
    }

    if (keys[child]){
        return true;
    }
    
    let h = hierarchy.intPtr(0, child);
    
    if (hasSiblingDecendent(child, keys, hierarchy, 0) || hasSiblingDecendent(child, keys, hierarchy, 1)) {
        return true;
    }
    
    if (hasDecendent(h[2], keys, hierarchy)) {
        return true;
    }
    
    return false;
}

function resizeImage(img_orig, img) {
    let img_resized = new cv.Mat();
    let dsize = new cv.Size(Math.round(img_orig.cols*params.resizeHeight/img_orig.rows), params.resizeHeight);
    cv.resize(img_orig, img_resized, dsize, 0, 0, cv.INTER_AREA);
    
    cv.cvtColor(img_resized, img, cv.COLOR_BGR2GRAY);
    img_resized.delete();
}

function erosion(img) {    
    let kernel = cv.Mat.ones(params.erosionKernel, params.erosionKernel, cv.CV_8U);
    let anchor = new cv.Point(-1, -1);
    cv.erode(img, img, kernel, anchor, params.erosionIterations, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    kernel.delete();
}

function getBoundingBox(img) {
    let minCol= img.cols; let minRow = img.rows;
    let maxCol= 0; let maxRow = 0;
    for (let col = 0; col < img.cols; col++) {
        for (let row = 0; row < img.rows; row++) {
            let pt = img.ucharAt(row, col);
            if (pt != 255) {
                if (col < minCol) {
                    minCol = col;
                }
                if (row < minRow) {
                    minRow = row;
                }
                if (col > maxCol) {
                    maxCol = col;
                }
                if (row > maxRow) {
                    maxRow = row;
                }
            }
        }
    }
    return [new cv.Point(minCol, minRow), new cv.Point(maxCol, maxRow)];
}

function isLargeRectangular(cnt, height, width) {
    let area = cv.contourArea(cnt);
    let rect = cv.boundingRect(cnt);
    let areaBox = rect.height * rect.width;
    return area > (height*width*0.05) && area > areaBox * 0.95;
}

function getCentroid(cnt) {
    let M = cv.moments(cnt, false);
    return new cv.Point(M.m10/M.m00, M.m01/M.m00);
}

function sortContours(bubble_contours, contours, height, width) {
    let nContours = contours.size();
    let sorted_contours = new Array();
    for (let i = 0; i < nContours; i++) {
        if (!bubble_contours[i]) {
            continue;
        }
        sorted_contours.push(contours.get(i));
    }
    
    sorted_contours = sorted_contours.sort((cnt1, cnt2) => { 
      let c1 = getCentroid(cnt1);
      let c2 = getCentroid(cnt2);
      let score1 = (1-c1.x*1.0/width) + (c1.y*1.0/height);
      let score2 = (1-c2.x*1.0/width) + (c2.y*1.0/height);
      return ((score1<score2) ? -1 : 1);
    });

    return sorted_contours;
}


function pruneContours(contours, hierarchy, pruned_contours, pruned_hierarchy, height, width) {
    for (let i = 0; i < pruned_contours.length; i++) {
        let cnt = contours.get(i);
        pruned_hierarchy[i] = JSON.parse(JSON.stringify(hierarchy.intPtr(0, i)));

        // prune if area is too small or too large
        let area = cv.contourArea(cnt);
        if (area < params.minCntArea || area > ((height * params.maxCntArea) * (width * params.maxCntArea)) || isLargeRectangular(cnt, height, width)) {
            continue;
        }
        
        pruned_contours[i] = true;
    }
    
    for (let i = 0; i < pruned_contours.length; i++) {
        if (!pruned_contours[i]) {
            continue;
        }
        let h = hierarchy.intPtr(0, i);
        if (!hasDecendent(h[2], pruned_contours, hierarchy)) {
            // this is now innermost
            pruned_hierarchy[i][2] = -1;
        }
    }
}

function isBubblelike(cnt) {
    let area = cv.contourArea(cnt);
    if (area < params.minBubbleArea) {
        return false; // too small
    }
    let perimeter = cv.arcLength(cnt,true);
    // prune if perimeter is more than n times that of a circle with the same area 
    // to remove complex shapes (A = P^2 / 4pi)
    return area > perimeter*perimeter/(params.complexitySensitivity*12);
}

function getBubbleContours(contours, hierarchy, pruned_contours, pruned_hierarchy, innermost_contours, level_2_contours, bubble_contours) {
    for (let i = 0; i < pruned_contours.length; i++) {
        if (!pruned_contours[i]) {
            continue;
        }
        let hier = pruned_hierarchy[i];
        
        if (hier[2] != -1) {
            continue; // not innermost contour
        }
        innermost_contours[i] = true;
        
        // get bubble-like parent of innermost contour
        i_parent = hier[3];
        while (i_parent != -1) {
            if (!pruned_contours[i_parent]) {
                i_parent = pruned_hierarchy[i_parent][3];
                continue;
            }
            if (level_2_contours[i_parent]) {
                break; // already found
            }
            
            let cnt = contours.get(i_parent);
            if (isBubblelike(cnt)) { 
                level_2_contours[i_parent] = true;
                break;
            }
            i_parent = pruned_hierarchy[i_parent][3];
        }
    }
    
    for (let i = 0; i < level_2_contours.length; i++) {
        if (!level_2_contours[i]) {
            continue;
        }
        // get innermost contours
        let h = hierarchy.intPtr(0, i);
        if (!hasDecendent(h[2], level_2_contours, hierarchy)) {
            bubble_contours[i] = true;
        }
    }
}

function getBubble(cnt, bubble, draw_mask, img) {
    let approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 0.001*cv.arcLength(cnt, true), true);
    let approxVec = new cv.MatVector(); approxVec.push_back(approx);
    cv.fillPoly(draw_mask, approxVec, new cv.Scalar(255,0,0));
    cv.bitwise_and(draw_mask, img, bubble);

    approxVec.delete();
    return cv.boundingRect(approx);
}

function getBubbleContents(bubble, draw_mask) {
    let draw_mask_inverted = new cv.Mat();
    cv.bitwise_not(draw_mask, draw_mask_inverted);
    cv.bitwise_or(draw_mask_inverted, bubble, bubble);
    draw_mask_inverted.delete();
}

function removeFurigana(bubble_orig) {
    let bubble = new cv.Mat();
    cv.adaptiveThreshold(bubble_orig, bubble, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, params.binarizationBlocksize, 10)
    cv.bitwise_not(bubble, bubble);
    
    // get start column and width of text
    let istart = -1;
    let texts = new Array();
    for (let col = 0; col < bubble.cols; col++) {
        let colSum = 0; // sum of all non-blank pixels in column
        for (let row = 0; row < bubble.rows; row++) {
            colSum += bubble.ucharAt(row, col);
        }
        
        if (colSum <= 255 * params.furiganaSensitivity || col == bubble.cols-1) { // if is in blank area or reached end
            if (istart != -1) { // if previously in text
                texts.push([istart, col - istart]);
                istart = -1;
            }
        } else if (istart == -1) { // if not already in text
            istart = col;
        }
    }
    
    // get max text width
    let maxWidth = 0;
    for (let i = 0; i < texts.length; i++) {
        if (texts[i][1] > maxWidth) {
            maxWidth = texts[i][1];
        }
    }
    if (maxWidth == 0) {
        return; // no text
    }
    
    for (let i = 0; i < texts.length; i++) {
        if (texts[i][1] > maxWidth * params.furiganaWidth) {
            continue; // text is too wide to be furigana
        }
        
        let istart = texts[i][0];
        let iend = istart + texts[i][1];
        // remove furigana
        for (let i = istart; i < iend; i++) {
            for (let row = 0; row < bubble_orig.rows; row++) {
                bubble_orig.ucharPtr(row, i)[0] = 255;
            }
        }
    }
}

function displayOcrBoxes(name, img_gray, data) {
    if (!params.verboseMode) {
        return;
    }
    
    let img = new cv.Mat();
    try {
        cv.cvtColor(img_gray, img, cv.COLOR_GRAY2RGBA);
    } catch(e) {
        img = img_gray;
    }

    data.words.forEach(t => {
        if (t.confidence >= 0) {
            var box = t.bbox;
            cv.rectangle(img, new cv.Point(box.x0, box.y0), new cv.Point(box.x1, box.y1), 
            new cv.Scalar(255*t.confidence/100,0,255*(100-t.confidence)/100,255), 1);
        }
        
        console.log(t.text, t.confidence);
    });
    
    cv.imshow(name, img);
    img.delete();
}

const OCR_FULL_PAGE = 1;
const OCR_JPN_VERT = 2;
const OCR_JPN = 3;
const LANG_PATH = 'https://cdn.rawgit.com/naptha/tessdata/gh-pages/4.0.0_best/';
async function getOcrText(input, mode) {
    
    let statusDisplay = document.getElementById('ocr-status');
    
    let worker;
    if (mode == OCR_FULL_PAGE) {
        worker = Tesseract.createWorker({
            logger: m => statusDisplay.innerHTML = m.status + " - " + m.progress,
            langPath: LANG_PATH,
        });
    } else {
        worker = Tesseract.createWorker({
            langPath: LANG_PATH,
        });
    }

    // run tesseract
    await worker.load();

    switch (mode) {
        case OCR_FULL_PAGE:
            await worker.loadLanguage('jpn_vert+jpn+osd');
            await worker.initialize('jpn_vert+jpn+osd');
            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT_OSD,
            });
            break;
        case OCR_JPN_VERT:
            await worker.loadLanguage('jpn_vert');
            await worker.initialize('jpn_vert');
            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT,
            });
            break;
        case OCR_JPN:
            await worker.loadLanguage('jpn+jpn_vert');
            await worker.initialize('jpn+jpn_vert');
            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            });
            break;
        default:
            console.log("Error: invalid ocr mode");
    }

    const response = await worker.recognize(input);
    console.log(response);
    console.log(response.data.text);
    await worker.terminate();

    return response.data;
}

function ocrConfident (ocr) {
    return ocr.words.find(t => (t.confidence >= 80)) != undefined;
}

function getJSON (url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status === 200) {
        callback(null, xhr.response);
      } else {
        callback(status, xhr.response);
      }
    };
    xhr.send();
};

function getTranslationDeepl(input, i) {            
    let url = 'https://api-free.deepl.com/v2/translate?auth_key='+DEEPL_KEY+'&text='+input+'&target_lang=EN';
    getJSON(url, 
    function(err, data){
        if (err !== null) {
          document.getElementById("trans-"+i).innerHTML += 'Something went wrong: ' + err;
          return;
        }
        let trans = data.translations.find(t => (t.detected_source_language == 'JA'));
        console.log(trans);
        document.getElementById("trans-"+i).innerHTML += trans.text;
    });
}

//imgElement.onload = function() {

function run() {
    initParams();
    
    //let img_orig = cv.imread("original");
    let img_orig = cv.imread(imgElement);
    
    // process image
    
    let img = new cv.Mat();
    resizeImage(img_orig, img);
    let height = img.size().height;
    let width = img.size().width;
    if (params.verboseMode) cv.imshow("original", img);
    
    // get text from full page
    if (params.runTesseract && params.getAdditionalText) {
        (async () => {
            let img64 = document.getElementById("original").toDataURL();
            let data = await getOcrText(img64, OCR_FULL_PAGE);
            displayOcrBoxes("output", cv.imread("original"), data);
        })();
    }
    
    let img_cleaned = new cv.Mat();
    cv.adaptiveThreshold(img, img_cleaned, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, params.binarizationBlocksize, params.binarizationSubtraction)
    if (params.verboseMode) cv.imshow("binarization", img_cleaned);
    
    erosion(img_cleaned);
    let boundingBox = getBoundingBox(img_cleaned);
    cv.rectangle(img_cleaned, boundingBox[0], boundingBox[1], new cv.Scalar(0,0,0), 3);
    if (params.verboseMode) cv.imshow("erosion", img_cleaned);
    
    // get contours
    
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    //cv.bitwise_not(img_cleaned, img_cleaned)
    cv.findContours(img_cleaned, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
    
    let nContours = contours.size();
    let colors = new Array(nContours); initContourColors(colors);
    displayContours('allContours', new Array(nContours).fill(true), contours, colors, img);

    // process contours
    
    let pruned_contours = new Array(nContours).fill(false);
    let pruned_hierarchy = new Array(nContours).fill(0).map(x => Array(4).fill(0));
    pruneContours(contours, hierarchy, pruned_contours, pruned_hierarchy, height, width);
    displayContours('prunedContours', pruned_contours, contours, colors, img);
    
    let innermost_contours = new Array(nContours).fill(false);
    let level_2_contours = new Array(nContours).fill(false);
    let bubble_contours = new Array(nContours).fill(false);
    getBubbleContours(contours, hierarchy, pruned_contours, pruned_hierarchy, innermost_contours, level_2_contours, bubble_contours);
    displayContours('innermostContours', innermost_contours, contours, colors, img);
    displayContours('level2Contours', level_2_contours, contours, colors, img);
    displayContours('bubbleContours', bubble_contours, contours, colors, img);
    
    // extract bubbles and text
    
    sorted_contours = sortContours(bubble_contours, contours, height, width);
    
    createOutputTable(sorted_contours.length);
    for (let i = 0; i < sorted_contours.length; i++) {
        
        let bubble = cv.Mat.zeros(img.rows, img.cols, cv.CV_8U);
        let draw_mask = cv.Mat.zeros(img.rows, img.cols, cv.CV_8U);
        let rect = getBubble(sorted_contours[i], bubble, draw_mask, img);
        if (params.verboseMode) cv.imshow("bubble-"+i, bubble.roi(rect));
        
        getBubbleContents(bubble, draw_mask);
        bubble = bubble.roi(rect);
        if (params.verboseMode) cv.imshow("bubble-contents-"+i, bubble);
        
        removeFurigana(bubble);
        cv.imshow("furigana-"+i, bubble);
        
        draw_mask.delete();
        
        // get text from bubbles
        if (!params.runTesseract) {
            continue;
        }
        (async () => {
            let bubble64 = document.getElementById("furigana-"+i).toDataURL();
            
            /*let jpn = await getOcrText(bubble64, OCR_JPN);
            document.getElementById("text-h-"+i).innerHTML += "<br/>" + jpn.text.replaceAll('\n', "<br/>") + "<br/>confidence: " + jpn.confidence + "%";
            displayOcrBoxes("ocr-h-"+i, bubble, jpn);*/
            
            let vert = await getOcrText(bubble64, OCR_JPN_VERT);
            if (!ocrConfident(vert)) {
                return;
            }
            let text = vert.text.replaceAll('\n', "<br/>");
            //document.getElementById("text-v-"+i).innerHTML += "<br/>" + text + "confidence: " + vert.confidence + "%";
            displayOcrBoxes("ocr-v-"+i, bubble, vert);
            
            document.getElementById("text-"+i).innerHTML += "<br/>" + text;
            
            getTranslationDeepl(text.replaceAll("<br/>", ""), i)
            
            
            bubble.delete();
        })();

    }
    

    img.delete();
    img_cleaned.delete();
    contours.delete(); 
    hierarchy.delete();
    
};

function onOpenCvReady() {
  document.getElementById('status').innerHTML = 'OpenCV.js is ready.';
  
}
