function doGet() {
  try {
    var sheet = SpreadsheetApp.openById("13V7H3ZoXgkM0Q_zrvYXs_kbzROHyX-jNaURvHAyJCPE").getSheets()[0];
    var lastRow = sheet.getLastRow();
    
    // Log the range being read
    console.log(`Reading range: A1:B${lastRow}`);
    
    // Get data with headers
    var data = sheet.getRange(1, 1, lastRow, 2).getValues();
    
    // Log the raw data with row numbers
    console.log('Raw sheet data with row numbers:');
    data.forEach((row, index) => {
      console.log(`Row ${index + 1}: [${row.map(cell => JSON.stringify(cell)).join(', ')}]`);
    });

    // Log the raw data for debugging
    console.log('Raw sheet data:', JSON.stringify(data));

    // Process the data rows (skip header row if exists)
    const headerRow = data[0];
    const isFirstRowHeader = headerRow[0] === 'Username' || headerRow[0] === 'username';
    const startRow = isFirstRowHeader ? 1 : 0;
    
    console.log(`Processing data starting from row ${startRow + 1} (${isFirstRowHeader ? 'skipping header' : 'no header row'})`);
    
    // Create an array of arrays with [username, displayName]
    var response = {
      users: data
        .slice(startRow) // Skip header row if present
        .filter(row => row[0] && row[0].toString().trim()) // Filter out empty rows
        .map((row, index) => {
          const username = row[0] ? row[0].toString().trim().toLowerCase() : '';
          const displayName = row[1] ? row[1].toString().trim() : username;
          console.log(`Row ${startRow + index + 1}: Username="${username}", DisplayName="${displayName}"`);
          return [username, displayName];
        })
    };

    console.log('Sending response:', JSON.stringify(response));
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error in doGet:', error);
    var errorResponse = { error: error.message, users: [] };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}