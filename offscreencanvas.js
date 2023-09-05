onmessage = function(event){
    let imageData =event.data.imageData;
	if (event.data.customPalette == false){
		generatePixelartAutoGenPalette(imageData, event.data.paletteSize, event.data.ditheringIntensity, event.data.pixelDimension);
	}
	else{
		generatePixelartCustomPalette(imageData, event.data.palette, event.data.ditheringIntensity, event.data.pixelDimension);
	}
    self.postMessage(imageData);
    self.close();
};
const BAYER8 =
[
	[0, 32, 8, 40, 2, 34, 10, 42],
	[48, 16, 56, 24, 50, 18, 58, 26],
	[12, 44, 4, 36, 14, 46, 6, 38],
	[60, 28, 52, 20, 62, 30, 54, 22],
	[3, 35, 11, 43, 1, 33, 9, 41],
	[51, 19, 59, 27, 49, 17, 57, 25],
	[15, 47, 7, 39, 13, 45, 5, 37],
	[63, 31, 55, 23, 61, 29, 53, 21]
];
const BAYER4 =
[
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5]
];
class Color{
    constructor(r, g, b, a){
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
}
const COLORS={
	RED: 'RED',
    GREEN: 'GREEN',
    BLUE: 'BLUE'
};
function clamp(number, low, high){
	return Math.max(Math.min(number, high), low);
}
function generatePixelart1(imageData){
	let partitionedColors = [];
    postMessage({stage:"Scanning image"});
    let colors = getUniqueColors(imageData);
    postMessage({stage:"Creating color pallete"});
    medianCut(colors, 3, partitionedColors);
    let pallete = getAvgColorFromSet(partitionedColors);
    postMessage({stage:"Rendering image"});
    pixelizeOrdered(imageData, pallete, 8, 5, 0.2);
}
function generatePixelartAutoGenPalette(imageData, paletteSize, ditheringIntensity, pixelDimension){
	let partitionedColors = [];
    postMessage({stage:"Scanning image"});
    let colors = getUniqueColors(imageData);
    postMessage({stage:"Creating color pallete"});
    medianCut(colors, Math.log2(paletteSize), partitionedColors);
    let palette = getAvgColorFromSet(partitionedColors);
    postMessage({stage:"Rendering image"});
    pixelizeOrdered(imageData, palette, 8, pixelDimension, ditheringIntensity/100);
}
function generatePixelartCustomPalette(imageData, rgbaArr, ditheringIntensity, pixelDimension){
    postMessage({stage:"Processing palette"});
	let palette = createPaletteFromRGBA(rgbaArr);
    postMessage({stage:"Rendering image"});
	console.log(palette);
    pixelizeOrdered(imageData, palette, 8, pixelDimension, ditheringIntensity/100);
}
function createPaletteFromRGBA(rgbaArr){
	let palette =[];
	for (let i=0; i<rgbaArr.length; i+=4){
		palette.push(new Color(rgbaArr[i],rgbaArr[i+1],rgbaArr[i+2],rgbaArr[i+3]));
	}
	return palette;
}

// partitionedColors is of type Color[][]
// The function returns a pallete (Color[]) which corresponds
// to the union of the average color of each partition
function getAvgColorFromSet(partitionedColors) {
	// Linear color channel sums
	let pallete =[];

	for (let partition of partitionedColors) {
		let rSum = 0;
		let gSum = 0;
		let bSum = 0;
		for (let color of partition){
			rSum +=color.r;
			gSum += color.g;
			bSum +=color.b;
		}
		let partitionSize = partition.length;
		let r = Math.round(rSum / partitionSize);
		let g = Math.round(gSum / partitionSize);
		let b = Math.round(bSum / partitionSize);
		pallete.push(new Color(r, g, b, 255));
	}
	return pallete;
}

// Compares two colors in the following descending order of channels: red, green, blue
// Returns true if a < b and false otherwise
function colorComparator(a, b) {
	if (a.r != b.r) return a.r - b.r;
	if (a.g != b.g) return a.g - b.g;
	return a.b - b.b;
}

// Returns an array (Color[]) containing unique colors extracted from the image
function getUniqueColors(imageData) {
	let colors = [];
	let uniqueColors = [];
	let height = imageData.height;
	let width = imageData.width;

    let imgDataArr = imageData.data;

	// Adding pixels to a temporary vector
	let color={};

	for (let i = 0;i < imgDataArr.length; i+=4) {
		color = new Color(imgDataArr[i], imgDataArr[i+1], imgDataArr[i+2],imgDataArr[i+3]);
		colors.push(color);
	}
 
	self.postMessage({stage:"Extracting colors"});
	// Sorting the array
	colors.sort(colorComparator);

	// Iterating over the sorted array of colors and only extracting unique colors i.e removing duplicates
	// Extract the color at the first index and add it to the vector of unique colors
	color = colors[0]; 
	uniqueColors.push(color);
	for (let i = 1; i < colors.length; i++) {
        
		// If the color at index i is equal to the color held in the variable "color" then the color is a duplicate that has already been added
		if (color.r == colors[i].r && color.g == colors[i].g && color.b == colors[i].b) continue;
		// If the color is not a duplicate then add it to the vector of unique colors
		color = colors[i];
		uniqueColors.push(color);
	}

	return uniqueColors;
}
//Takes a color and an array of colors(pallete) and returns the color in the pallete that is the 
// closest to it
function findNearestColor(mainColor, pallete) {
	let nearestColor;
	let minDistance = 999999;
	let distance;
	let rDiff;
	let gDiff;
	let bDiff;
	for (let color of pallete) {
		rDiff = color.r - mainColor.r;
		gDiff = color.g - mainColor.g;
		bDiff = color.b - mainColor.b;

		distance = 3*(rDiff * rDiff) + 6*(gDiff * gDiff) + (bDiff * bDiff);
		if (distance < minDistance) {
			nearestColor = color;
			minDistance = distance;
		}
	}
	return nearestColor;
}

// Takes an array of colors and a begin and end index
// Returns an enum representing the color/channel with the highest range
function colorHighestRange(colors, begin, end) {
	// Finding the color with the highest range
	let maxR = colors[begin].r;
	let minR = colors[begin].r;

	let maxG = colors[begin].g;
	let minG = colors[begin].g;

	let maxB = colors[begin].b;
	let minB = colors[begin].b;
	let color = {};
	for (let i = begin; i <= end; i++) {
		color = colors[i];
		if (color.r > maxR) maxR = color.r;
		if (color.r < minR) minR = color.r;

		if (color.g > maxG) maxG = color.g;
		if (color.g < minG) minG = color.g;

		if (color.b > maxB) maxB = color.b;
		if (color.b < minB) minB = color.b;
	}
	let rRange = maxR - minR;
	let gRange = maxG - minG;
	let bRange = maxB - minB;

	// If the red channels has the largest range
	if (rRange >= gRange && rRange >= bRange) {
		return COLORS.RED;
	}
	// If the green channel has the largest range
	else if (gRange >= rRange && gRange >= bRange) {
		return COLORS.GREEN;
	}
	// If the blue channel has the largest range
	else {
		return COLORS.BLUE;
	}
}
// Color[] colors, int begin, int end, int depth, Color[][] partitionedColors
// Takes an array of colors a beginning and end index and a two dimensional array of colors
// that gets populated with color partitions. The functions returns nothing.
function medianCut(colors, depth, partitionedColors) {
	//Base case
	if (depth == 0 || colors.length==1) {
		// Take the partition of pixels passed and add them to partitionedColors vector
		let partition = [];
		for (let i = 0; i < colors.length; i++) {
			partition.push(colors[i]);
		}
		partitionedColors.push(partition);
		return;
	}
	let highestRange = colorHighestRange(colors, 0, colors.length-1);
	switch (highestRange) {
		case COLORS.RED:
			colors.sort(rColorComparator);
			break;
		case COLORS.GREEN:
			colors.sort(gColorComparator);
			break;
		case COLORS.BLUE:
			colors.sort(bColorComparator);
	}

	let medianIndex = Math.floor(colors.length / 2);

	medianCut(colors.slice(0, medianIndex), depth - 1, partitionedColors);
	medianCut(colors.slice(medianIndex), depth - 1, partitionedColors);
}

function rColorComparator(a, b) {
	return a.r - b.r;
}
function gColorComparator(a, b) {
	return a.g - b.g;
}
function bColorComparator(a, b) {
	return a.b - b.b;
}
// Takes a pallete as input and returns an int[] representing the maximum
// difference between two consecutive values in each respective color channel
function maxDistanceChannel(pallete) {
	let result = [0, 0, 0];
	let rChannel =[];
	let gChannel =[];
	let bChannel =[];

	for (let i = 0; i < pallete.length; i++) {
		rChannel.push(pallete[i].r);
	}
	for (let i = 0; i < pallete.length; i++) {
		gChannel.push(pallete[i].g);
	}
	for (let i = 0; i < pallete.length; i++) {
		bChannel.push(pallete[i].b);
	}
	
	result[0] = maxDistanceInArray(rChannel);
	result[1] = maxDistanceInArray(gChannel);
	result[2] = maxDistanceInArray(bChannel);
	
	return result;
}

// returns the maximum distance between two consecutive numbers in
// an array
function maxDistanceInArray(channel) {
	channel.sort((a,b)=>{return a-b;});
	let distance = 0;
	let max = 0;
	for (let i = 1; i < channel.length; i++) {
		distance = Math.abs(channel[i] - channel[i - 1]);
		if (distance > max) max = distance;
	}
	return max;
}
// This function pixelizes and dithers the image given a pallete, a ratio to
// determine the amount of pixelization (number of pixels in output = inputAmount/pixelRatio^2), and a percentage of pixelization
function pixelizeOrdered(imageData, pallete, bayerSize, pixelRatio, ditherAmount) {
	let bayerScalarDenominator = 64.0;
	let inPosX;
	let inPosY;

	let palleteOffset = maxDistanceChannel(pallete);

	let inputColor;
	let attempt;
	let outputColor;
	let r;
	let g;
	let b;
	let BAYER =[];
	if(bayerSize ==8){
		BAYER = BAYER8;
		bayerSize=8;
	}
	else {
		BAYER = BAYER4;
		bayerSize =4;
	}
    let imageDataArr = imageData.data;
    let width = imageData.width;
	let outImageBlocksX = Math.floor(imageData.width/pixelRatio);
	let outImageBlocksY = Math.floor(imageData.height/pixelRatio);
	for (let i = 0; i < outImageBlocksX; i++) {
		for (let j = 0; j < outImageBlocksY; j++) {
			inPosX = i * pixelRatio;
			inPosY = j * pixelRatio;
			// Selecting pixels for the output image based on its closest neighbor in the input image given the scalling ratio 
			
			let pixelIndex =(inPosX + inPosY*width)*4;

			r = imageDataArr[pixelIndex] + ((palleteOffset[0]) * ditherAmount * ((BAYER[i % bayerSize][j % bayerSize]/ bayerScalarDenominator)-0.5));
			g = imageDataArr[pixelIndex+1] + ((palleteOffset[1])  * ditherAmount * ((BAYER[i % bayerSize][j % bayerSize] / bayerScalarDenominator) - 0.5));
			b = imageDataArr[pixelIndex+2] + ((palleteOffset[2]) * ditherAmount * ((BAYER[i % bayerSize][j % bayerSize] / bayerScalarDenominator) - 0.5));


			attempt = new Color(clamp(Math.round(r), 0, 255), clamp(Math.round(g), 0, 255), clamp(Math.round(b), 0, 255), imageDataArr[pixelIndex+3]);
			outputColor = findNearestColor(attempt, pallete);
			imageDataArr[pixelIndex] = outputColor.r;
			imageDataArr[pixelIndex+1] = outputColor.g;
			imageDataArr[pixelIndex+2] = outputColor.b;
			//Filling up the each RATIOxRATIO block in the outImage with the pixel selected
			for (let k = 0; k < pixelRatio; k++) {
				for (let l = 0; l < pixelRatio; l++) {
                    let tempIndex =((i * pixelRatio + k) + (j * pixelRatio + l)*width)*4;
					imageDataArr[tempIndex] = outputColor.r;
                    imageDataArr[tempIndex+1] = outputColor.g;
                    imageDataArr[tempIndex+2] = outputColor.b;
				}
			}
		}
	}
}