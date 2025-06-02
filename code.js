// Main plugin code that runs in Figma's sandbox
figma.showUI(__html__, {
  width: 320,
  height: 600,
  themeColors: true
});

// Send initial selection info to UI
updateSelectionInfo();

// Listen for selection changes
figma.on('selectionchange', () => {
  updateSelectionInfo();
});

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'generate-grid') {
      await generateGrid(msg.params);
    } else if (msg.type === 'cancel') {
      figma.closePlugin();
    }
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: error.message
    });
  }
};

function updateSelectionInfo() {
  const selection = figma.currentPage.selection;
  let selectionInfo = {
    type: 'selection-update',
    hasValidSelection: false,
    selectedFrame: null,
    message: ''
  };

  if (selection.length === 0) {
    selectionInfo.message = 'Please select a frame to fill with a grid.';
  } else if (selection.length > 1) {
    selectionInfo.message = 'Please select only one frame at a time.';
  } else if (selection[0].type !== 'FRAME') {
    selectionInfo.message = 'Please select a frame (not a ' + selection[0].type.toLowerCase() + ').';
  } else {
    const frame = selection[0];
    selectionInfo.hasValidSelection = true;
    selectionInfo.selectedFrame = {
      name: frame.name,
      width: Math.round(frame.width),
      height: Math.round(frame.height)
    };
    selectionInfo.message = `Selected frame: ${frame.name} (${Math.round(frame.width)}×${Math.round(frame.height)}px)`;
  }

  figma.ui.postMessage(selectionInfo);
}

async function generateGrid(params) {
  const selection = figma.currentPage.selection;

  // Validate selection
  if (selection.length !== 1 || selection[0].type !== 'FRAME') {
    throw new Error('Please select exactly one frame to fill with a grid.');
  }

  const frame = selection[0];
  const frameWidth = frame.width;
  const frameHeight = frame.height;

  // Validate parameters
  if (params.gridInterval <= 0 || params.gridInterval > Math.max(frameWidth, frameHeight)) {
    throw new Error('Grid interval must be positive and smaller than frame dimensions.');
  }

  // Clear existing grid lines (optional - remove if you want to keep existing content)
  const existingLines = frame.children.filter(child =>
    (child.type === 'LINE' || child.type === 'VECTOR' || child.type === 'RECTANGLE') && child.name.startsWith('Grid Line')
  );
  existingLines.forEach(line => line.remove());

  // Convert hex colors to RGB
  const primaryRGB = hexToRgb(params.primaryColor);
  const secondaryRGB = hexToRgb(params.secondaryColor);

  // Generate primary vertical lines
  for (let x = 0; x <= frameWidth; x += params.gridInterval) {
    const line = figma.createRectangle();
    line.name = 'Grid Line (Primary Vertical)';
    line.x = x - params.primaryWeight / 2; // Center the line on the x position
    line.y = 0;
    line.resize(params.primaryWeight, frameHeight); // width = line weight, height = frame height
    line.fills = [{
      type: 'SOLID',
      color: primaryRGB
    }];
    frame.appendChild(line);
  }

  // Generate secondary vertical lines
  if (params.secondaryLines > 0) {
    const secondaryInterval = params.gridInterval / (params.secondaryLines + 1);
    for (let primaryX = 0; primaryX < frameWidth; primaryX += params.gridInterval) {
      for (let i = 1; i <= params.secondaryLines; i++) {
        const x = primaryX + (secondaryInterval * i);
        if (x < frameWidth) {
          const line = figma.createRectangle();
          line.name = 'Grid Line (Secondary Vertical)';
          line.x = x - params.secondaryWeight / 2; // Center the line on the x position
          line.y = 0;
          line.resize(params.secondaryWeight, frameHeight); // width = line weight, height = frame height
          line.fills = [{
            type: 'SOLID',
            color: secondaryRGB
          }];
          frame.appendChild(line);
        }
      }
    }
  }

  // Generate primary horizontal lines
  for (let y = 0; y <= frameHeight; y += params.gridInterval) {
    const line = figma.createRectangle();
    line.name = 'Grid Line (Primary Horizontal)';
    line.x = 0;
    line.y = y - params.primaryWeight / 2; // Center the line on the y position
    line.resize(frameWidth, params.primaryWeight); // width = frame width, height = line weight
    line.fills = [{
      type: 'SOLID',
      color: primaryRGB
    }];
    frame.appendChild(line);
  }

  // Generate secondary horizontal lines
  if (params.secondaryLines > 0) {
    const secondaryInterval = params.gridInterval / (params.secondaryLines + 1);
    for (let primaryY = 0; primaryY < frameHeight; primaryY += params.gridInterval) {
      for (let i = 1; i <= params.secondaryLines; i++) {
        const y = primaryY + (secondaryInterval * i);
        if (y < frameHeight) {
          const line = figma.createRectangle();
          line.name = 'Grid Line (Secondary Horizontal)';
          line.x = 0;
          line.y = y - params.secondaryWeight / 2; // Center the line on the y position
          line.resize(frameWidth, params.secondaryWeight); // width = frame width, height = line weight
          line.fills = [{
            type: 'SOLID',
            color: secondaryRGB
          }];
          frame.appendChild(line);
        }
      }
    }
  }

  // Calculate statistics
  const primaryLinesH = Math.floor(frameWidth / params.gridInterval) + 1;
  const primaryLinesV = Math.floor(frameHeight / params.gridInterval) + 1;
  const primaryIntervalsH = Math.floor(frameWidth / params.gridInterval);
  const primaryIntervalsV = Math.floor(frameHeight / params.gridInterval);
  const secondaryLinesH = params.secondaryLines > 0 ? primaryIntervalsH * params.secondaryLines : 0;
  const secondaryLinesV = params.secondaryLines > 0 ? primaryIntervalsV * params.secondaryLines : 0;

  // Send success message
  figma.ui.postMessage({
    type: 'grid-generated',
    stats: {
      primaryLinesH,
      primaryLinesV,
      secondaryLinesH,
      secondaryLinesV,
      totalLines: primaryLinesH + primaryLinesV + secondaryLinesH + secondaryLinesV
    }
  });

  figma.notify('Grid generated successfully!');
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
}
