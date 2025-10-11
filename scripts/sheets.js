const { google } = require("googleapis");
require('dotenv').config({path: '../.env'});

(async() => {
    const {
        OAuth2
      } = google.auth;
      const oAuth2Client = new OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
      oAuth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });

    // const auth = new google.auth.GoogleAuth({
    //     keyFile: "../keys.json", //the key file
    //     //url to spreadsheets API
    //     scopes: "https://www.googleapis.com/auth/spreadsheets", 
    // });
    // const authClientObject = await auth.getClient();
    const googleSheetsInstance = google.sheets({ version: "v4", auth: oAuth2Client });

    /**
     * The spreadsheet ID to be obtained from the URL of the Google sheets.
     *  It is the alphanumeric value that is between the /d/ and the /edit in the URL of your spreadsheet.
     */
    // const bookingsSpreadsheetId = '1rNhaFsCQyvBZp7PieRjEmwb24Mg8cHCxUn1vSsfJFWA';

    // const enquiriesSpreadsheetId = '1M84JkvCi825L9zv7bKX-nYl1h2FOXqbITwnvhm9qK8o';


    const spreadSheetId = '1M84JkvCi825L9zv7bKX-nYl1h2FOXqbITwnvhm9qK8o';
    //write data into the google sheets
    const test = [
        Object.values({
            cart: 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xSnJVVFlMY0xwTDhMTEdwKL2nxpsGMgY31gf8B1c6LBagHHiQy_ESXLVzSPX6jx3EjgK6P24gRqFauIk8NyeL2WztSdFk3BylVqTq',
            payer_info_email: 'jesus20.11@hotmail.es',
            payer_info_first_name: 'Jesus',
            payer_info_last_name: 'Díaz Rivas',
            payer_info_address: '0',
            payer_info_city: null,
            payer_info_state: null,
            payer_info_postal_code: null,
            payer_info_country_code: 'ES',
            transactions_amount_total: '375.00',
            transactions_amount_subtotal: 'n.a',
            transactions_amount_shipping_discount: 'n.a.',
            transactions_invoice_number: 'SSM522610110',
            create_time: '2022-11-14T01:02:38.382Z',
            created_by: 'Stripe',
          })
    ];
    const parsedDate = new Date("2022-12-14T01:02:38.382Z")
    const monthStart =  parsedDate.toLocaleDateString("en", { month: "short" });
    const year = parsedDate.getFullYear();
    const sheetTitle = `${monthStart} ${year}`;
    const {data: {sheets}} = await googleSheetsInstance.spreadsheets.get({
        spreadsheetId: spreadSheetId,
    })
    console.log(sheets, 'sheets');
    const existingSheet = sheets.find(sheet => sheet.properties.title === sheetTitle);
    if (!existingSheet){
        await googleSheetsInstance.spreadsheets.batchUpdate({
            spreadsheetId: spreadSheetId,
            requestBody:{
                requests: [
                    {
                        'addSheet':{
                            'properties':{
                                'title': sheetTitle
                            }
                        } 
                    }
            
                ]
            }
        })
    }
   
    //The resource object has a child value, which is an array of the data to be entered into the sheets. The array length depends on the number of columns of the spreadsheet.
    await googleSheetsInstance.spreadsheets.values.append({
        auth : oAuth2Client, //auth object
        spreadsheetId: spreadSheetId, //spreadsheet id
        range: sheetTitle, //sheet name and range of cells
        valueInputOption: "USER_ENTERED", // The information will be passed according to what the usere passes in as date, number or text
        resource: {
            values: test,
        },
    });

    //Read front the spreadsheet
    const {data} = await googleSheetsInstance.spreadsheets.values.get({
        auth: oAuth2Client, //auth object
        spreadsheetId: spreadSheetId, // spreadsheet id
        range: "Sheet1", //range of cells to read from.
    })



    console.log(data, 'data');


})();