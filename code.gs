function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'No data'}))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Server is bezig, probeer het zo opnieuw'}))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      throw new Error('Ongeldige gegevens ontvangen');
    }

    if (!data.submissionId || !data.naam || !data.datum) {
      throw new Error('Verplichte velden ontbreken (submissionId, naam of datum)');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Bepaal bladnaam volgens loonperiode (bijv. "Fay_maart_2026")
    const userSheetName = getLoonperiodeSheetNaam(data.naam, data.datum);

    const overzichtHeaders = ["Submission ID", "Medewerker", "Datum", "Begintijd", "Eindtijd", "Pauze minuten", "Gewerkte minuten", "Gewerkte uren", "Reiskosten type", "Aantal KM", "Vergoeding per KM", "Totale vergoeding", "Toelichting", "Timestamp"];
    const userHeaders = ["Submission ID", "Datum", "Begintijd", "Eindtijd", "Pauze minuten", "Gewerkte minuten", "Gewerkte uren", "Reiskosten type", "Aantal KM", "Vergoeding per KM", "Totale vergoeding", "Toelichting", "Timestamp"];

    // 1. Check/Maak Overzicht Sheet
    const overzichtSheet = getOrCreateSheet(ss, "Overzicht", overzichtHeaders);

    // Anti-duplicate check in Overzicht
    const dataRange = overzichtSheet.getDataRange();
    const values = dataRange.getValues();
    let isDuplicate = false;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.submissionId) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      // 2. Data in Overzicht zetten
      writeRow(overzichtSheet, [
        data.submissionId, data.naam, data.datum, data.begintijd, data.eindtijd,
        toNumber(data.pauzeMinuten), toNumber(data.gewerkteMinuten), toNumber(data.gewerkteUren),
        data.reiskostenType, toNumber(data.aantalKM), toNumber(data.vergoedingPerKM),
        toNumber(data.berekendeVergoeding), data.toelichting, data.timestamp
      ]);

      // 3. Check/Maak Medewerker Sheet (bijv. "Fay_maart_2026")
      const userSheet = getOrCreateSheet(ss, userSheetName, userHeaders);

      // 4. Data in Medewerker Sheet zetten
      writeRow(userSheet, [
        data.submissionId, data.datum, data.begintijd, data.eindtijd,
        toNumber(data.pauzeMinuten), toNumber(data.gewerkteMinuten), toNumber(data.gewerkteUren),
        data.reiskostenType, toNumber(data.aantalKM), toNumber(data.vergoedingPerKM),
        toNumber(data.berekendeVergoeding), data.toelichting, data.timestamp
      ]);

      SpreadsheetApp.flush();
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.message || error.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Bepaal bladnaam volgens loonperiode (19e t/m 18e)
// Bijv. datum 2026-02-19 -> Fay_maart_2026
// Bijv. datum 2026-03-18 -> Fay_maart_2026
function getLoonperiodeSheetNaam(naam, dateStr) {
  const parts = dateStr.split('-'); // YYYY-MM-DD
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1; // 0-indexed (0=jan, 1=feb...)
  const day = parseInt(parts[2], 10);

  // Vanaf de 19e geldt de volgende uitbetalingsmaand
  if (day >= 19) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const maanden = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december"
  ];

  return naam + "_" + maanden[month] + "_" + year;
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getRange(1, 1).getValue() === "") {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  }
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }
  if (sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) {
    sheet.protect()
         .setDescription("Automatisch gevuld door de urenregistratie-app. Niet handmatig sorteren of bewerken.")
         .setWarningOnly(true);
  }
  return sheet;
}

function writeRow(sheet, row) {
  const lastRow = sheet.getLastRow();
  let nextRow = 2;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (ids[i][0] !== "") {
        nextRow = i + 3;
        break;
      }
    }
  }
  const values = row.map(sanitizeValue);
  const range = sheet.getRange(nextRow, 1, 1, values.length);
  range.setNumberFormats([values.map(v => typeof v !== "number" ? "@" : (Number.isInteger(v) ? "0" : "0.00"))]);
  range.setValues([values]);
}

function sanitizeValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  const str = String(value).replace(/[
]+/g, " ").trim();
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

function toNumber(value) {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}
