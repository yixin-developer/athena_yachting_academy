// allow access to env variables in dev mode
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// define and pull all environment variables from .env
const sessionSecret = process.env.SESSION_SECRET;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublicKey = process.env.STRIPE_PUBLIC_KEY;
const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalEnvMode = process.env.PAYPAL_ENV_MODE;
const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const mailchimpURL = process.env.MAILCHIMP_URL;
const mailchimpAPIKey = process.env.MAILCHIMP_API_KEY;
const nodeMailerEmailAddress = process.env.NODEMAILER_EMAIL_ADDRESS;
const nodeMailerReceiversEmailAddresses = process.env.NODEMAILER_RECEIVERS_EMAIL_ADDRESSES;
const mongoDBAtlasPassword = process.env.MONGODBATLAS_PASSWORD;
const domain = process.env.DOMAIN;
const captchaKey = process.env.GOOGLE_RECAPTCHA_SITE_KEY;
const captchaSecret = process.env.GOOGLE_RECAPTCHA_SITE_SECRET;
const bookingsSpreadsheetId = process.env.BOOKING_SPREADSHEET_ID;
const enquiriesSpreadsheetId = process.env.ENQUIRY_SPREADSHEET_ID;

// import Node packages
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const favicon = require('serve-favicon');
const mongoose = require('mongoose');
const multer = require('multer');
const methodOverride = require('method-override');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const paypal = require('paypal-rest-sdk');
const stripe = require('stripe')(stripeSecretKey);
const nodemailer = require('nodemailer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const requestIp = require('request-ip');
const { google } = require('googleapis');
const compression = require('compression');

// call Express
const app = express();

// force http to https
var https_redirect = function (req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    if (req.headers['x-forwarded-proto'] != 'https') {
      return res.redirect('https://' + req.headers.host + req.url);
    } else {
      return next();
    }
  } else {
    return next();
  }
};

// middleware connections
app.set('view engine', 'ejs');
app.use(https_redirect);
app.use(bodyParser.json());
app.use(compression());
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));
app.use(requestIp.mw());

// paypal environment setting
paypal.configure({
  mode: paypalEnvMode, //sandbox or live
  client_id: paypalClientId,
  client_secret: paypalClientSecret,
});

// connect to MongoDB
// const mongoURI = 'mongodb+srv://admin_yixin:' + mongoDBAtlasPassword + '@cluster0-jmiqr.mongodb.net/ssmDB';
// const mongoURI = 'mongodb+srv://aya_admin:z6MSyRiMxUdw2Dx7@cluster0.aynkvcs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const mongoURI= 'mongodb://aya_admin:z6MSyRiMxUdw2Dx7@ac-xunka1c-shard-00-00.aynkvcs.mongodb.net:27017,ac-xunka1c-shard-00-01.aynkvcs.mongodb.net:27017,ac-xunka1c-shard-00-02.aynkvcs.mongodb.net:27017/ayaDB?ssl=true&replicaSet=atlas-1mzag4-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connect(mongoURI, {
  dbName:"ayaDB",
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.set('useCreateIndex', true);
const conn = mongoose.connection;

// init gridFsStorage and stream
let gfs;
conn.once('open', function () {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// create file storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  options: {
    useUnifiedTopology: true,
  },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads',
        };
        resolve(fileInfo);
      });
    });
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10000000,
  },
});

// create user log-in schema and model
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
});

userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model('User', userSchema);

// use Passport to empower session
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Require oAuth2 from our google instance and create a new calender instance.
const { OAuth2 } = google.auth;
const oAuth2Client = new OAuth2(googleClientID, googleClientSecret);
oAuth2Client.setCredentials({
  // How to get the refresh token:
  // 1. Create OAUTH2 consent screen, go to
  // https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fmail.google.com%2F%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fspreadsheets%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly%2Chttps%3A%2F%2Fmail.google.com%2F%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.settings.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fspreadsheets%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fspreadsheets.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fspreadsheets%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fspreadsheets.readonly&url=https%3A%2F%2F&content_type=application%2Fjson&http_method=GET&useDefaultOauthCred=checked&oauthEndpointSelect=Google&oauthAuthEndpointValue=https%3A%2F%2Faccounts.google.com%2Fo%2Foauth2%2Fv2%2Fauth&oauthTokenEndpointValue=https%3A%2F%2Foauth2.googleapis.com%2Ftoken&includeCredentials=unchecked&accessTokenType=query&autoRefreshToken=checked&accessType=offline&prompt=consent&response_type=code&wrapLines=on
  // Get the url and use it as a callback
  // Give the auth consent, clieck Excanche authorization and get the refresh token
  refresh_token: googleRefreshToken,
});
const calendar = google.calendar({
  version: 'v3',
  auth: oAuth2Client,
});

// create mongoDB collections schemas
const bookingSchema = {
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  birthday: String,
  address: String,
  city: String,
  state: String,
  country: String,
  zip: String,
  legalNotice: String,
  signUp: String,
  selectedCourseTitle: String,
  selectedCourseDate: String,
  preferedCourseDate: String,
  selectedCourseUnitPrice: Number,
  numberOfPeople: Number,
  extraItems: Array,
  totalPriceDiscount: String,
  totalBeforeDiscount: Number,
  discountAmount: Number,
  paymentAmount: Number,
  invoiceNumber: String,
  timeCreated: Date,
  creator: String,
};

const couponSchema = {
  coupon: String,
  discount: Number,
  expiration: Date,
};

const courseDateSchema = {
  title: String,
  category: String,
  date: Date,
  duration: Number,
  location: String,
  instructor: String,
  vessel: String,
  capacity: Number,
  available: Number,
  pricePerson: Number,
  priceExclusive: Number,
  comment: String,
};

const courseProfileSchema = {
  title: String,
  category: String,
  introduction: String,
  duration: Number,
  price: Number,
  capacity: Number,
  courseLink: String,
  ryaLink: String,
  onlineLink: String,
  experience: String,
  level: String,
  availability: String,
  image: String,
};

const enquirySchema = new mongoose.Schema({
  name: String,
  email: String,
  topic: String,
  date: String,
  quantity: String,
  message: String,
  subscribe: String,
});

const extraItemSchema = {
  name: String,
  price: Number,
  unit: String,
  inventory: Number,
  category: String,
  description: String,
  images: Array,
  applicableCourses: Array,
};

const paymentSchema = {
  id: String,
  paymentDetails: String,
};

const postSchema = {
  title: String,
  subtitle: String,
  date: Date,
  author: String,
  category: String,
  content: String,
  image: Array,
};

const promotionSchema = {
  title: String,
  content: String,
  link: String,
  expiration: Date,
  launchedTime: Date,
  launchedBy: String,
};

const transactionSchema = {
  id: String,
  state: String,
  cart: String,
  payment_method: String,
  payer_info_email: String,
  payer_info_first_name: String,
  payer_info_last_name: String,
  payer_info_id: String,
  payer_info_address: String,
  payer_info_city: String,
  payer_info_state: String,
  payer_info_country_code: String,
  payer_info_postal_code: String,
  transactions_amount_total: String,
  transactions_amount_subtotal: String,
  transactions_amount_shipping_discount: String,
  transactions_item_list_items: Array,
  transactions_invoice_number: String,
  create_time: Date,
  created_by: String,
};

const uploadSchema = {
  id: String,
  filename: String,
  category: String,
  description: String,
  contentType: String,
  uploadDate: Date,
};

// create mongoDB models
const Booking = mongoose.model('Booking', bookingSchema);
const Coupon = mongoose.model('Coupon', couponSchema);
const CourseDate = mongoose.model('CourseDate', courseDateSchema);
const CourseProfile = mongoose.model('CourseProfile', courseProfileSchema);
const Enquiry = mongoose.model('Enquiry', enquirySchema);
const ExtraItem = mongoose.model('ExtraItem', extraItemSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Post = mongoose.model('Post', postSchema);
const Promotion = mongoose.model('Promotion', promotionSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Upload = mongoose.model('Upload', uploadSchema);

////////////////////////////////Home Page Functions////////////////////////////

// 0. render home page
app.get('/', async function (req, res) {
  21;
  Post.find({}, function (err, postsFound) {
    if (!err) {
      const sortedPostsFound = postsFound.sort((a, b) => b.date - a.date);
      CourseDate.find({}, function (err, courseFound) {
        if (!err) {
          let courseList = [];
          courseFound.forEach(function (course, index) {
            var today = new Date();
            if (course.date > today) {
              courseList.push(course);
            }
          });
          const sortedCourseList = courseList.sort((a, b) => a.date - b.date);
          res.render('home', {
            sortedPostsFound: sortedPostsFound,
            sortedCourseList: sortedCourseList,
          });
        }
      });
    }
  });
});

// 1. sign-up to newsletter
app.post('/sign-up', function (req, res) {
  // console.log(req.body, 'sign-up body')
  const { email, firstName, lastName, status = 'subscribed', address, course, phone, birthday } = req.body || {};
  console.log(req.body, 'req.body mailchimp');
  let parsedBirthday = '';
  if (birthday) {
    parsedBirthday = new Date(birthday).toLocaleDateString('en-ES', {
      // you can use undefined as first argument
      month: '2-digit',
      day: '2-digit',
    });
  }
  // console.log(parsedBirthday)
  const data = {
    members: [
      {
        email_address: email,
        status: status,

        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
          BIRTHDAY: parsedBirthday,
          COURSE: course,
          FULLADDR: address,
          PHONE: phone,
          COURSE: course,
        },
      },
    ],
    update_existing: true,
  };

  // mailchimp subscription and API setting
  const jsonData = JSON.stringify(data);
  const url = mailchimpURL;

  const option = {
    method: 'POST',
    auth: mailchimpAPIKey,
  };

  // send info through API
  const request = https.request(url, option, function (response) {
    if (response.statusCode === 200) {
      Coupon.findOne(
        {
          discount: 10,
        },
        function (err, couponFound) {
          res.redirect(`/signup-success?couponFound=${couponFound}`);
        },
      );
    } else {
      // console.log(response);
      res.render('partials/signup-failure');
    }

    response.on('data', function (data) {
      console.log(data.toString());
    });
  });

  request.write(jsonData);
  request.end();
});

// 2. render signup success page
app.get('/signup-success', (req, res) => {
  res.render('partials/signup-success', {
    couponFound: req?.query?.couponFound,
  });
});

// 3. submit enquiry form to email address, register in google sheet, add to mailchimp subscription list
app.post('/enquiry', upload.none(), async function (req, res) {
  try {
    const { recaptchaResponse, ...enquiryData } = req.body;
    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${captchaSecret}&response=${recaptchaResponse}`;
    console.log(url);
    const captchaVerifyRes = await fetch(url, {
      method: 'POST',
    });
    const captchaVerifyData = await captchaVerifyRes.json();
    if (!captchaVerifyData.success) {
      throw new Error(captchaVerifyData['error-codes']);
    }

    const enquiry = new Enquiry(enquiryData);

    enquiry.save(function (err) {
      if (err) {
        console.log(err);
        res.status(400);
        res.render('partials/enquiry-failure');
      }
    });
    const { email, message, name, topic, date, quantity } = enquiryData;
    // form unicode output
    const output = `
      <p>You have a new enquiry</p>
      <ul>
        <li>Name: ${name}</li>
        <li>Email: ${email}</li>
        <li>Course/Topic: ${topic}</li>
        <li>Prefered date: ${date}</li>
        <li>Number of people: ${quantity}</li>
        <li>Subscription: ${req.body.subscribe}</li>
      </ul>
      <h3>Message</h3>
      <p>${message}</p>
    `;

    // setup email data with unicode symbols
    let mailOptions = {
      from: '"SSM Web" <' + nodeMailerEmailAddress + '>', // sender address
      to: nodeMailerReceiversEmailAddresses, // list of receivers
      subject: 'New Course Enquiry', // Subject line
      html: output, // html body
    };

    const myAccessToken = oAuth2Client.getAccessToken();

    try {
      let transporter = nodemailer.createTransport({
        service: 'gmail',
        secure: false, // true for 465, false for other ports
        tls: {
          rejectUnauthorized: false, //if sending from localhost, set false
        },
        auth: {
          type: 'OAuth2',
          user: nodeMailerEmailAddress,
          clientId: googleClientID,
          clientSecret: googleClientSecret,
          refreshToken: googleRefreshToken,
          accessToken: myAccessToken,
        },
      });
      // send mail with defined transport object
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          res.status(400);
          return res.render('partials/enquiry-failure');
        }
      });
    } catch (err) {
      res.status(400);
      res.render('partials/enquiry-failure');
    }

    const location = await getClientLocation(req);
    await saveEnquiryToSpreadsheet({
      spreadsheetId: bookingsSpreadsheetId,
      values: [
        Object.values({
          'Course Title': topic,
          'Selected Course Date ': '',
          'Prefered Course Date': date,
          Status: 'Interested',
          Name: name?.split(' ')?.[0] || '',
          Surname: name?.split(' ')?.[1] || '',
          Email: email,
          Phone: '',
          Note: message,
          'Course Unit Price': '',
          'No. People': quantity,
          'Total Before Discount': '',
          Discount: '',
          'Discount Amount': '',
          'Payment Amount': '',
          'Amount Paid': '',
          'Pending Amount': '',
          'Refunded Amount': '',
          Fee: '',
          Channel: '',
          'Invoice Number': '',
          Country: '',
          State: '',
          City: '',
          Address: '',
          Zip: '',
          'Ip Location': location,
          'Date Created': new Date().toISOString().split('T')[0],
        }),
      ],
    });

    await saveEnquiryToSpreadsheet({
      spreadsheetId: enquiriesSpreadsheetId,
      values: [
        Object.values({
          email,
          name,
          topic,
          date,
          quantity,
          message,
          creationDate: new Date().toISOString().split('T')[0],
          location,
        }),
      ],
      sheetTitle: 'Sheet1',
    });

    // Subscribe to newsletter
    await subscribeToNewsLetter(req, email);
    res.status(200).send('');
  } catch (err) {
    console.log(err);
  }
});

// 4. enquiry-success to trigger Google Analytics event
app.get('/enquiry-success', (req, res) => {
  res.render('partials/enquiry-success');
});

// 5. subscribe to newsletter
async function subscribeToNewsLetter(req, email, signUp, bookingInfo) {
  const { firstName, lastName, course, phone, birthday, address } = bookingInfo || {};
  console.log(email, signUp, bookingInfo, 'woww');
  try {
    await fetch(`${req.protocol}://${req.get('host')}/sign-up`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        status: signUp === 'No' ? 'unsubscribed' : 'subscribed',
        firstName,
        lastName,
        course,
        address,
        phone,
        birthday,
      }),
    });
  } catch (err) {
    console.log(err, 'sign-up-enquiry-error');
  }
}

// 6. spreadsheet function enquiry helper
async function saveEnquiryToSpreadsheet({ spreadsheetId, values, sheetTitle = 'Enquiry', range }) {
  const googleSheetsInstance = google.sheets({
    version: 'v4',
    auth: oAuth2Client,
  });

  /**
   * The spreadsheet ID to be obtained from the URL of the Google sheets.
   *  It is the alphanumeric value that is between the /d/ and the /edit in the URL of your spreadsheet.
   */

  //write data into the google sheets

  //The resource object has a child value, which is an array of the data to be entered into the sheets. The array length depends on the number of columns of the spreadsheet.

  const addedSheet = await googleSheetsInstance.spreadsheets.values.append({
    auth: oAuth2Client, //auth object
    spreadsheetId, //spreadsheet id
    range: range || sheetTitle, //sheet name and range of cells
    valueInputOption: 'USER_ENTERED', // The information will be passed according to what the usere passes in as date, number or text
    resource: {
      values,
    },
  });

  const {
    data: { sheets },
  } = await googleSheetsInstance.spreadsheets.get({
    spreadsheetId,
  });

  const existingSheet = sheets.find((sheet) => sheet.properties.title === sheetTitle);
  await setSheetRowBackground(
    { addedSheet, googleSheetsInstance, spreadsheetId, existingSheet, values },
    {
      red: 255,
      green: 242,
      blue: 204,
    },
  );
}

/////////////////////////////////////Static Pages//////////////////////////////

// 1. render about-us page
app.get('/about-us', function (req, res) {
  res.render('about-us');
});

// 2. render charter-and-cruise page
app.get('/charter-and-cruises', function (req, res) {
  res.render('charter-and-cruises');
});

// 3. render accommodation page
app.get('/accommodation', function (req, res) {
  res.render('accommodation');
});

// 4. render FAQs page
app.get('/faqs', function (req, res) {
  res.render('faqs');
});

// 5. render contact page
app.get('/contact', function (req, res) {
  res.render('contact', { captchaKey });
});

// 6. render legal-notice page
app.get('/legal-notice', function (req, res) {
  res.render('legal-notice');
});

// 7. render privacy-policy page
app.get('/privacy-policy', function (req, res) {
  res.render('privacy-policy');
});

// 8. render yacht page
app.get('/yachts', function (req, res) {
  res.render('yachts');
});

// 9. render yacht lookfar page
app.get('/yachts/lookfar', function (req, res) {
  res.render('accommodation');
});

// 10. render yacht xanax page
app.get('/yachts/xanax', function (req, res) {
  res.render('charter-and-cruises');
});

// 11. render site map
app.get('/sitemap', function (req, res) {
  res.render('sitemap');
});
/////////////////////////////////Authorization System//////////////////////////

// 1. render login page
app.get('/login', function (req, res) {
  res.render('login');
});

// 2. user login
app.post('/login', function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate('local')(req, res, function () {
        res.redirect('/console');
      });
    }
  });
});

// 3. user log out
app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/');
});

// 4. user registration (not in use)
app.post('/register', function (req, res) {
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/console");
      });
    }
  });
});

//////////////////////////////////////Console//////////////////////////////////

// 0. render console page (need Authorization)
app.get('/console', function (req, res) {
  if (req.isAuthenticated()) {
    const pastThreeMonthsDate = new Date();
    pastThreeMonthsDate.setMonth(pastThreeMonthsDate.getMonth() - 3);
    CourseDate.find({}, function (err, coursesFound) {
      if (!err) {
        let coursesList = [];
        coursesFound.forEach(function (course, index) {
          var today = new Date();
          if (course.date > today) {
            coursesList.push(course);
          }
        });
        const sortedCoursesList = coursesList.sort((a, b) => a.date - b.date);

        CourseProfile.find({}, function (err, profilesFound) {
          if (!err) {
            Post.find({}, function (err, postsFound) {
              if (!err) {
                const sortedPostsFound = postsFound.sort((a, b) => b.date - a.date);

                Transaction.find(
                  {
                    create_time: {
                      $gte: pastThreeMonthsDate,
                    },
                  },
                  function (err, transactionsFound) {
                    if (!err) {
                      const sortedTransactions = transactionsFound.sort((a, b) => b.create_time - a.create_time);

                      Booking.find(
                        {
                          timeCreated: {
                            $gte: pastThreeMonthsDate,
                          },
                        },
                        function (err, bookingsFound) {
                          if (!err) {
                            const sortedBookings = bookingsFound.sort((a, b) => b.timeCreated - a.timeCreated);

                            Coupon.find({}, function (err, couponsFind) {
                              if (!err) {
                                var validCoupons = [];
                                var today = new Date();
                                couponsFind.forEach(function (coupon, index) {
                                  if (coupon.expiration > today) {
                                    validCoupons.push(coupon);
                                  }
                                });

                                ExtraItem.find({}, function (err, extraItemsFound) {
                                  if (!err) {
                                    Enquiry.find({}, function (err, enquiriesFound) {
                                      enquiriesFound = enquiriesFound.filter(
                                        ({ _id }) => _id.getTimestamp() > pastThreeMonthsDate,
                                      );
                                      if (!err) {
                                        Promotion.find({}, function (err, promotionsFound) {
                                          if (!err) {
                                            // console.log(sortedBookings.slice(sortedBookings.length - 10, sortedBookings.length));
                                            res.render('console', {
                                              sortedCoursesList: sortedCoursesList,
                                              profilesFound: profilesFound,
                                              sortedPostsFound: sortedPostsFound,
                                              enquiriesFound: enquiriesFound,
                                              extraItemsFound: extraItemsFound,
                                              sortedTransactions: sortedTransactions,
                                              sortedBookings: sortedBookings,
                                              promotionsFound: promotionsFound,
                                              validCoupons: validCoupons,
                                            });
                                          }
                                        });
                                      }
                                    });
                                  }
                                });
                              }
                            });
                          }
                        },
                      );
                    }
                  },
                );
              }
            });
          }
        });
      }
    });
  } else {
    res.redirect('/login');
  }
});

/////////////////////////////////Course Dates System///////////////////////////

// 0. render course dates page
app.get('/course-dates', async function (req, res) {
  const courseFound = await CourseDate.find({});

  // //console.log(courseFound);
  let courseList = [];
  courseFound.forEach((course, index) => {
    const today = new Date();
    if (course.date > today) {
      courseList.push(course);
    }
  });
  let sortedCourseList = courseList.sort((a, b) => a.date - b.date);
  sortedCourseList = sortedCourseList.map(({ _doc: { _id, __v, ...rest } }) => rest);

  const parsedCourseList = sortedCourseList.reduce((acc, { title, date, available }) => {
    if (Array.isArray(acc[title]?.data)) {
      acc[title].data.push({
        date,
        available,
      });
    } else {
      acc[title] = { data: [{ date, available }] };
    }
    return acc;
  }, {});

  const courseProfilesFound = (await CourseProfile.find({})).reduce(
    (acc, { title, level, courseLink, image, category, duration, price: pricePerson, capacity }) => {
      acc[title] = {
        level,
        courseLink,
        image,
        category,
        duration,
        pricePerson,
        capacity,
      };
      return acc;
    },
    {},
  );
  // console.log(courseProfilesFound)
  const fullCourseList = Object.entries(courseProfilesFound).map(([title, obj]) => {
    return {
      title,
      ...parsedCourseList[title],
      info: { ...parsedCourseList[title]?.info, ...obj },
    };
  });

  const categories = {
    'Sail Practical': 'RYA Practical Sail Cruising',
    Powerboat: 'RYA Practical Powerboat',
    'Shore-based': 'RYA Shorebased Courses',
    Motorboat: 'RYA Practical Motor Cruising',
    'Transport Malta': 'Transport Malta',
    Others: 'Other Courses',
  };

  const levels = {
    Beginner: 'Beginner',
    Intermediate: 'Intermediate',
    Advanced: 'Advanced',
    Professional: 'Professional',
  };

  const priorityCourses = [
    'RYA Start Yachting',
    'RYA Competent Crew',
    'RYA Day Skipper Practical',
    'RYA Coastal Skipper Practical',
    'RYA Day Skipper Theory',
    'RYA Coastal Skipper Yachtmaster Offshore Theory',
    'Transport Malta Nautical License',
    'RYA Level 2 Powerboat Handling',
    'RYA Marine Radio',
  ];
  const parseIndex = (index) => (index < 0 ? 600 : index);
  fullCourseList
    .sort(
      (course1, course2) =>
        parseIndex(priorityCourses.indexOf(course1.title)) - parseIndex(priorityCourses.indexOf(course2.title)),
    )
    .map((course) => course.title);

  res.render('course-dates', {
    courseList: fullCourseList,
    courseProfilesFound,
    categories,
    levels,
  });
});

// 1. render create course date page (need Authorization)
app.get('/course-dates/create', async function (req, res) {
  if (req.isAuthenticated()) {
    let course = {};
    if (req.query.courseId) {
      course = await CourseDate.findOne({ _id: req.query.courseId });
    }
    res.render('create-course-date', { course: course });
  } else {
    res.redirect('/login');
  }
});

// 2. create and save new course date to database and create google calendar event (need Authorization)
app.post('/course-dates/create', function (req, res) {
  if (req.isAuthenticated()) {
    const courseDate = new CourseDate({
      title: req.body.title,
      category: req.body.category,
      date: req.body.date,
      duration: req.body.duration,
      location: req.body.location,
      instructor: req.body.instructor,
      vessel: req.body.vessel,
      capacity: req.body.capacity,
      available: req.body.available,
      pricePerson: req.body.pricePerson,
      priceExclusive: req.body.priceExclusive,
      comment: req.body.comment,
    });

    courseDate.save(function (err, savedCourseDate) {
      if (!err) {
        //console.log("successfully saved new course date");
        //console.log(savedCourseDate);

        // Google Calendar - create a new event start date instance for temp uses in our calendar.
        const eventStartTime = new Date(req.body.date);
        // assume all courses start at 9:30am and end at 17:30
        eventStartTime.setHours(9, 30, 0);
        const eventEndTime = new Date(
          eventStartTime.getTime() + ((req.body.duration - 1) * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        );
        //console.log(eventStartTime, eventEndTime);
        let colorId = 0;
        // color event by course category
        switch (req.body.category) {
          case 'RYA Shorebased Courses':
            colorId = 2;
            break;
          case 'RYA Practical Sail Cruising':
            colorId = 7;
            break;
          case 'RYA Practical Motor Cruising':
            colorId = 6;
            break;
          case 'RYA Practical Powerboat':
            colorId = 11;
            break;
          case 'Transport Malta':
            colorId = 5;
            break;
          case 'STCW Courses':
            colorId = 1;
            break;
          case 'Online Courses':
            colorId = 8;
            break;
          case 'Other Courses':
            colorId = 3;
        }
        // Create a dummy event for temp uses in our calendar
        const event = {
          id: savedCourseDate._id,
          created: new Date(),
          summary: req.body.title,
          location: req.body.location,
          description: 'Instructor: ' + req.body.instructor + ' | ' + 'Boat: ' + req.body.vessel,
          status: 'tentative',
          colorId: colorId,
          creator: {
            displayName: 'Sailing School Malta',
            email: 'info@sailingschoolmalta.com',
          },
          attendees: [],
          reminders: {
            useDefault: false,
            overrides: [
              {
                method: 'email',
                minutes: 1440,
              },
            ],
          },
          start: {
            dateTime: eventStartTime,
            timeZone: 'Europe/Rome',
          },
          end: {
            dateTime: eventEndTime,
            timeZone: 'Europe/Rome',
          },
          visibility: 'public',
        };

        // Check if we are busy and have an event on our calendar for the same time.
        calendar.freebusy.query(
          {
            resource: {
              timeMin: eventStartTime,
              timeMax: eventEndTime,
              timeZone: 'Europe/Rome',
              items: [
                {
                  id: 'primary',
                },
              ],
            },
          },
          function (err, res) {
            // Check for errors in our query and log them if they exist.
            if (err) {
              return console.error('Free Busy Query Error: ', err);
            }
            // Create an array of all events on our calendar during that time.
            const eventArr = res.data.calendars.primary.busy;
            // Check if event array is empty which means we are not busy
            if (eventArr.length === 0) {
              // If we are not busy create a new calendar event.
              return calendar.events.insert(
                {
                  calendarId: 'primary',
                  resource: event,
                  // colorId: ,
                },
                function (err) {
                  // Check for errors and log them if they exist.
                  if (err) return console.error('Error Creating Calender Event:', err);
                  // Else log that the event was created.
                  return; //console.log('Calendar event successfully created.');
                },
              );
            } else {
              // If we are busy
              //console.log(`there is already a course at same time`);
              // create another new calendar event.
              return calendar.events.insert(
                {
                  calendarId: 'primary',
                  resource: event,
                  // colorId: ,
                },
                function (err) {
                  // Check for errors and log them if they exist.
                  if (err) return console.error('Error Creating Calender Event:', err);
                  // Else log that the event was created.
                  return; //console.log('Calendar event successfully created.');
                },
              );
            }
          },
        );
        res.redirect('/console');
      } else {
        res.send(err);
      }
    });
  } else {
    res.redirect('/login');
  }
});

// 3. render edit specific course date page (need Authorization)
app.get('/course-dates/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    let id = req.params.id;
    CourseDate.findOne(
      {
        _id: id,
      },
      function (err, courseFound) {
        if (!err) {
          res.render('edit-course-date', {
            courseFound: courseFound,
          });
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 4. update specific course date in database and update calender event (need Authorization)
app.post('/course-dates/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    CourseDate.updateOne(
      {
        _id: req.params.id,
      },
      {
        $set: req.body,
      },
      function (err) {
        if (!err) {
          //update the Google calender course event
          const eventStartTime = new Date(req.body.date);
          // assume all courses start at 9:30am and end at 17:30
          eventStartTime.setHours(9, 30, 0);
          const eventEndTime = new Date(
            eventStartTime.getTime() + ((req.body.duration - 1) * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
          );
          // Create a dummy event for temp uses in our calendar
          const event = {
            updated: new Date(),
            summary: req.body.title,
            location: req.body.location,
            description: 'Instructor: ' + req.body.instructor + ' | ' + 'Boat: ' + req.body.vessel,
            start: {
              dateTime: eventStartTime,
              timeZone: 'Europe/Rome',
            },
            end: {
              dateTime: eventEndTime,
              timeZone: 'Europe/Rome',
            },
          };
          var params = {
            calendarId: 'primary',
            eventId: req.params.id,
            resource: event,
          };
          //console.log(params)
          calendar.events.patch(params, function (err) {
            if (err) {
              //console.log('The API returned an error: ' + err);
              return;
            }
            //console.log('Event updated.');
          });
          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 5. delete specific course date in database and delete calender event (need Authorization)
app.post('/course-dates/delete/:id', function (req, res) {
  if (req.isAuthenticated()) {
    CourseDate.deleteOne(
      {
        _id: req.params.id,
      },
      function (err) {
        if (!err) {
          // delete Google calender event
          var params = {
            calendarId: 'primary',
            eventId: req.params.id,
          };
          calendar.events.delete(params, function (err) {
            if (err) {
              //console.log('The API returned an error: ' + err);
              return;
            }
            //console.log('Event deleted.');
          });

          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

///////////////////////////////Course Profiles System//////////////////////////

// 0. render all courses page
app.get('/courses', function (req, res) {
  CourseProfile.find({}, function (err, courseProfilesFound) {
    if (!err) {
      res.render('courses', {
        courseProfilesFound: courseProfilesFound,
      });
    }
  });
});

// 1. render choosing the right courses page
app.get('/courses/choosing-the-right-course', function (req, res) {
  res.render('choosing-the-right-course');
});

// 2. render RYA shorebased cateogry page
app.get('/courses/rya-shorebased-courses', function (req, res) {
  const priorityCourses = [
    'RYA Essential Navigation And Seamanship',
    'RYA Day Skipper Theory',
    'RYA Coastal Skipper Yachtmaster Offshore Theory',
    'RYA Yachtmaster Ocean Theory',
    'RYA Marine Radio',
    'RYA First Aid',
    'RYA Professional Practices And Responsibilities',
    'RYA Diesel Engine',
    'RYA Radar',
    'RYA Sea Survival',
    'RYA Commercial Endorsements',
  ];
  CourseProfile.find(
    {
      category: 'RYA Shorebased Courses',
      availability: 'Yes',
    },
    function (err, coursesFound) {
      coursesFound.sort((a, b) => {
        return priorityCourses.indexOf(a.title) - priorityCourses.indexOf(b.title);
      });
      console.log(coursesFound.map(({ title }) => title));
      if (!err) {
        res.render('rya-shorebased-courses', {
          coursesFound: coursesFound,
        });
      }
    },
  );
});

// 3. render RYA practial sail cruising cateogry page
app.get('/courses/rya-practical-sail-cruising', function (req, res) {
  const priorityCourses = [
    'RYA Start Yachting',
    'RYA Competent Crew',
    'RYA Day Skipper Practical',
    'RYA Coastal Skipper Practical',
    'RYA Yachtmaster Fast Track',
    'RYA Day Skipper Package',
    'RYA Day Skipper Fast Track',
    'RYA Coastal Skipper Package',
    'RYA Yachtmaster Preparation And Exam',
  ];

  CourseProfile.find(
    {
      category: 'RYA Practical Sail Cruising',
      availability: 'Yes',
    },
    function (err, coursesFound) {
      coursesFound.sort((a, b) => {
        return priorityCourses.indexOf(a.title) - priorityCourses.indexOf(b.title);
      });
      if (!err) {
        res.render('rya-practical-sail-cruising', {
          coursesFound: coursesFound,
        });
      }
    },
  );
});

// 4. render RYA practial motor cruising cateogry page
app.get('/courses/rya-practical-motor-cruising', function (req, res) {
  const levels = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];

  CourseProfile.find(
    {
      category: 'RYA Practical Motor Cruising',
      availability: 'Yes',
    },
    function (err, coursesFound) {
      coursesFound.sort((a, b) => {
        return levels.indexOf(a.level) - levels.indexOf(b.level);
      });
      if (!err) {
        res.render('rya-practical-motor-cruising', {
          coursesFound: coursesFound,
        });
      }
    },
  );
});

// 5. render RYA practial powesrboat cateogry page
app.get('/courses/rya-practical-powerboat', function (req, res) {
  const levels = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];
  CourseProfile.find(
    {
      category: 'RYA Practical Powerboat',
      availability: 'Yes',
    },
    function (err, coursesFound) {
      coursesFound.sort((a, b) => {
        return levels.indexOf(a.level) - levels.indexOf(b.level);
      });
      if (!err) {
        res.render('rya-practical-powerboat', {
          coursesFound: coursesFound,
        });
      }
    },
  );
});

// 6. render individual course page
app.get('/courses/:courseName', async function (req, res) {
  var courseName = req.params.courseName;

  if (courseName.substring(0, 3) === 'rya') {
    var courseTitle = 'RYA' + titleCase(courseName.substring(3).replace(/-/g, ' '));
  } else if (courseName.substring(0, 4) === 'stcw') {
    courseTitle = 'STCW Courses';
  } else if (courseName.substring(0, 3) === 'icc') {
    courseTitle = 'ICC Assessment';
  } else if (courseName.substring(0, 3) === 'con') {
    courseTitle = 'Mile Builder';
    courseName = 'mile-builder';
  } else {
    courseTitle = titleCase(courseName.replace(/-/g, ' '));
  }

  function titleCase(str) {
    var splitStr = str.toLowerCase().split(' ');
    for (var i = 0; i < splitStr.length; i++) {
      // You do not need to check if i is larger than splitStr length, as your for does that for you
      // Assign it back to the array
      splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    // Directly return the joined string
    return splitStr.join(' ');
  }

  //console.log(courseTitle)

  try {
    const courseFound = await CourseDate.find({ title: courseTitle });
    let courseDates = [];
    let monthsYears = [];
    let courses = [];
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    courseFound.forEach(function (course, index) {
      var today = new Date();
      if (course.date > today) {
        courseDates.push(course.date);
        courses.push(course);
      }
    });

    let sortedCourseDates = courseDates.sort(function (a, b) {
      return a - b;
    });

    sortedCourseDates.forEach(function (x) {
      let monthYear = monthNames[x.getMonth()] + '\xa0' + (x.getYear() + 1900);
      monthsYears.push(monthYear);
    });

    let uniqueMonthsYears = [...new Set(monthsYears)];
    try {
      const courseProfileFound = await CourseProfile.findOne({
        title: courseTitle,
      });
      if (!courseName.includes('.')) {
        try {
          let files = await Upload.find({ category: courseName || 'Course' });
          files.map(function (file) {
            if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
              file.isImage = true;
            } else {
              file.isImage = false;
            }
          });
          files = files.map((file) => {
            delete file._doc._id;
            delete file._doc.uploadDate;
            return file;
          });

          res.render('courses/' + courseName, {
            courses: courses,
            courseName: courseName,
            uniqueMonthsYears: uniqueMonthsYears,
            courseProfileFound: courseProfileFound || {},
            files: files,
          });
        } catch (err) {
          console.log(err);
          res.send(err);
        }
      } else {
        console.log('redirect');
        res.redirect('/');
      }
    } catch (err) {
      console.log(err);
      res.send(err);
    }
  } catch (err) {
    console.log(err);
    res.send(err);
  }
});

// 7. render create course profile page (need Authorization)
app.get('/courses/course-profile/create', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('create-course-profile', {
      file: false,
    });
  } else {
    res.redirect('/login');
  }
});

// 8. create and post course profile to database (need Authorization)
app.post('/courses/course-profile/create', function (req, res) {
  if (req.isAuthenticated()) {
    const courseProfile = new CourseProfile({
      title: req.body.title,
      category: req.body.category,
      image: req.body.image,
      introduction: req.body.introduction,
      duration: req.body.duration,
      price: req.body.price,
      capacity: req.body.capacity,
      courseLink: req.body.courseLink,
      ryaLink: req.body.ryaLink,
      onlineLink: req.body.onlineLink,
      experience: req.body.experience,
      level: req.body.level,
      availability: req.body.availability,
    });
    //console.log(courseProfile);

    courseProfile.save(function (err) {
      if (!err) {
        //console.log("successfully saved new course profile");
        res.redirect('/console');
      }
    });
  } else {
    res.redirect('/login');
  }
});

// 9. render edit specific course profile page (need Authorization)
app.get('/courses/course-profile/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    let id = req.params.id;
    CourseProfile.findOne(
      {
        _id: id,
      },
      function (err, profileFound) {
        if (!err) {
          res.render('edit-course-profile', {
            profileFound: profileFound,
          });
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 10. update specific course profile in database (need Authorization)
app.post('/courses/course-profile/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    CourseProfile.update(
      {
        _id: req.params.id,
      },
      {
        $set: req.body,
      },
      function (err) {
        if (!err) {
          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 11. delete specific course profile in database (need Authorization)
app.post('/courses/course-profile/delete/:id', function (req, res) {
  if (req.isAuthenticated()) {
    CourseProfile.deleteOne(
      {
        _id: req.params.id,
      },
      function (err) {
        if (!err) {
          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

////////////////////////////////Course Booking System//////////////////////////

// 0. render course booking page
app.get('/booking/courses/:courseName', function (req, res) {
  var courseName = req.params.courseName;
  if (courseName.substring(0, 3) === 'rya') {
    var courseTitle = 'RYA' + titleCase(courseName.substring(3).replace(/-/g, ' '));
  } else if (courseName.substring(0, 4) === 'stcw') {
    courseTitle = 'STCW Courses';
  } else if (courseName.substring(0, 3) === 'icc') {
    courseTitle = 'ICC Assessment';
  } else {
    courseTitle = titleCase(courseName.replace(/-/g, ' '));
  }

  function titleCase(str) {
    var splitStr = str.toLowerCase().split(' ');
    for (var i = 0; i < splitStr.length; i++) {
      // You do not need to check if i is larger than splitStr length, as your for does that for you
      // Assign it back to the array
      splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    // Directly return the joined string
    return splitStr.join(' ');
  }

  // console.log(courseTitle);

  CourseDate.find(
    {
      title: courseTitle,
    },
    function (err, courseDatesFound) {
      if (!err) {
        let futureCourseDates = [];
        courseDatesFound.forEach(function (courseDate, index) {
          var today = new Date();
          if (courseDate.date > today) {
            futureCourseDates.push(courseDate);
          }
        });
        let sortedFutureCourseDates = futureCourseDates.sort((a, b) => a.courseDate - b.courseDate);
        CourseDate.find({}, function (err, e) {
          console.log(e);
        });

        CourseProfile.findOne(
          {
            title: courseTitle,
          },
          function (err, profileFound) {
            if (!err) {
              ExtraItem.find({}, function (err, extraItemsFound) {
                if (!err) {
                  Coupon.find({}, function (err, couponsFind) {
                    if (!err) {
                      var validCoupons = [];
                      var today = new Date();
                      couponsFind.forEach(function (coupon, index) {
                        if (coupon.expiration > today) {
                          validCoupons.push({
                            coupon: coupon.coupon,
                            discount: coupon.discount,
                          });
                        }
                      });

                      //   console.log(sortedFutureCourseDates, profileFound, validCoupons);
                      CourseProfile.find({}, function (err, coursesFound) {
                        if (profileFound) {
                          res.render('booking', {
                            courseTitle: courseTitle,
                            sortedFutureCourseDates: sortedFutureCourseDates,
                            profileFound: profileFound,
                            extraItemsFound: extraItemsFound,
                            validCoupons: validCoupons,
                            stripePublicKey: stripePublicKey,
                            coursesFound: coursesFound,
                          });
                        }
                      });
                    }
                  });
                }
              });
            }
          },
        );
      }
    },
  );
});

// 1. create Paypal payment, save booking and send validation to Paypal
app.post('/booking/paypal-pay', function (req, res) {
  //accept info from billing form
  let details = req.body;
  let itemsList = [];
  let extraItemsList = [];
  let subtotal = parseFloat(req.body.totalBeforeDiscount).toFixed(2);
  let discount = parseFloat(req.body.discountAmount).toFixed(2);
  let total = parseFloat(req.body.paymentAmount).toFixed(2);
  let invoiceNumber = 'SSM' + (Math.floor(Math.random() * 9000000000) + 10000000);

  //create course item
  if (req.body.selectedCourseTitle != '') {
    var course = {
      name: req.body.selectedCourseTitle,
      description: req.body.selectedCourseDate + req.body.preferedCourseDate,
      price: req.body.selectedCourseUnitPrice,
      currency: 'EUR',
      quantity: req.body.numberOfPeople,
    };
    itemsList.push(course);
  }
  //create exra items
  if (req.body.extraItem1Title != null) {
    var extraItem1 = {
      name: req.body.extraItem1Title,
      description: '',
      price: req.body.extraItem1Price,
      currency: 'EUR',
      quantity: req.body.extraItem1Volumn,
    };
    itemsList.push(extraItem1);
    extraItemsList.push(extraItem1);
  }
  if (req.body.extraItem2Title != null) {
    var extraItem2 = {
      name: req.body.extraItem2Title,
      description: '',
      price: req.body.extraItem2Price,
      currency: 'EUR',
      quantity: req.body.extraItem2Volumn,
    };
    itemsList.push(extraItem2);
    extraItemsList.push(extraItem2);
  }
  if (req.body.extraItem3Title != null) {
    var extraItem3 = {
      name: req.body.extraItem3Title,
      description: '',
      price: req.body.extraItem3Price,
      currency: 'EUR',
      quantity: req.body.extraItem3Volumn,
    };
    itemsList.push(extraItem3);
    extraItemsList.push(extraItem3);
  }
  if (req.body.extraItem4Title != null) {
    var extraItem4 = {
      name: req.body.extraItem4Title,
      description: '',
      price: req.body.extraItem4Price,
      currency: 'EUR',
      quantity: req.body.extraItem4Volumn,
    };
    itemsList.push(extraItem4);
    extraItemsList.push(extraItem4);
  }
  if (req.body.extraItem5Title != null) {
    var extraItem5 = {
      name: req.body.extraItem5Title,
      description: '',
      price: req.body.extraItem5Price,
      currency: 'EUR',
      quantity: req.body.extraItem5Volumn,
    };
    itemsList.push(extraItem5);
    extraItemsList.push(extraItem5);
  }
  if (req.body.extraItem6Title != null) {
    var extraItem6 = {
      name: req.body.extraItem6Title,
      description: '',
      price: req.body.extraItem6Price,
      currency: 'EUR',
      quantity: req.body.extraItem6Volumn,
    };
    itemsList.push(extraItem6);
    extraItemsList.push(extraItem6);
  }
  if (req.body.extraItem7Title != null) {
    var extraItem7 = {
      name: req.body.extraItem7Title,
      description: '',
      price: req.body.extraItem7Price,
      currency: 'EUR',
      quantity: req.body.extraItem7Volumn,
    };
    itemsList.push(extraItem7);
    extraItemsList.push(extraItem7);
  }
  if (req.body.extraItem8Title != null) {
    var extraItem8 = {
      name: req.body.extraItem8Title,
      description: '',
      price: req.body.extraItem8Price,
      currency: 'EUR',
      quantity: req.body.extraItem8Volumn,
    };
    itemsList.push(extraItem8);
    extraItemsList.push(extraItem8);
  }

  //print all to check
  //console.log("details", details, "itemsList", itemsList, "subtotal", subtotal, "discount", discount, "total", total, "invoiceNumber", invoiceNumber);

  //save booking info to database
  if (details.paymentAmount != 0) {
    const booking = new Booking({
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      phone: details.phone,
      birthday: details.birthday,
      address: details.address,
      country: details.country,
      state: details.state,
      city: details.city,
      zip: details.zip,
      legalNotice: details.legalNotice,
      signUp: details.signUp,
      selectedCourseTitle: details.selectedCourseTitle,
      selectedCourseDate: details.selectedCourseDate,
      preferedCourseDate: details.preferedCourseDate,
      selectedCourseUnitPrice: details.selectedCourseUnitPrice,
      numberOfPeople: details.numberOfPeople,
      extraItems: extraItemsList,
      totalPriceDiscount: details.totalPriceDiscount,
      totalBeforeDiscount: details.totalBeforeDiscount,
      discountAmount: details.discountAmount,
      paymentAmount: details.paymentAmount,
      invoiceNumber: invoiceNumber,
      timeCreated: details.timeCreated,
      creator: 'Paypal',
    });
    booking.save(function (err) {
      if (err) {
        console.log(err);
      } else {
        //console.log("booking info saved");
      }
    });
  }

  //create payment

  const create_payment_json = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal',
    },
    redirect_urls: {
      return_url: `${
        process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3000/' : domain
      }booking/paypal-pay/success`,
      cancel_url: `${
        process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3000/' : domain
      }booking/paypal-pay/cancel`,
    },
    transactions: [
      {
        item_list: {
          items: itemsList,
        },
        amount: {
          currency: 'EUR',
          total: total,
          details: {
            subtotal: subtotal,
            shipping_discount: discount,
          },
        },
        description: 'This order is created by Paypal NodeJS SDK V1',
        invoice_number: invoiceNumber,
      },
    ],
  };

  //send payment request to paypal for validation
  paypal.payment.create(create_payment_json, function (error, payment) {
    if (error) {
      console.log(error);
      // throw error;
      res.render('partials/payment-failure');
    } else {
      for (let i = 0; i < payment.links.length; i++) {
        if (payment.links[i].rel === 'approval_url') {
          let orderCost = total;
          res.redirect(payment.links[i].href);
        }
      }
    }
  });
});

// 2. paypal payment success, saving payment, update course places and send new attendee to google calendar event
app.get('/booking/paypal-pay/success', function (req, res) {
  //get payment ID and payer ID
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;
  const execute_payment_json = {
    payer_id: payerId,
  };

  //execute the payment, update the inventory and save payment info and update inventory
  paypal.payment.execute(paymentId, execute_payment_json, async function (error, payment) {
    //if error, the statements after throw won't be executed
    if (error) {
      console.log(error);
      res.render('partials/payment-failure');
    } else {
      var paymentDetails_string = JSON.stringify(payment);
      //redirect success
      res.redirect('/payment-success');
      //log returned payment information
      //save payment string to datebase
      const paymentSaved = await Payment.findOne({
        id: payment.id,
      });
      if (paymentSaved) {
        console.log('payment already exists');
        return;
      }
      const paymentDetails = new Payment({
        id: payment.id,
        paymentDetails: paymentDetails_string,
      });
      paymentDetails.save(function (err) {
        if (!err) {
          //console.log("payment info saved");
          //create booking order and save
          const transaction = new Transaction({
            id: payment.id,
            state: payment.state,
            cart: payment.cart,
            payment_method: payment.payer.payment_method,
            payer_info_email: payment.payer.payer_info.email,
            payer_info_first_name: payment.payer.payer_info.first_name,
            payer_info_last_name: payment.payer.payer_info.last_name,
            payer_info_id: payment.payer.payer_info.payer_id,
            payer_info_address: payment.payer.payer_info.shipping_address.line1,
            payer_info_city: payment.payer.payer_info.shipping_address.city,
            payer_info_state: payment.payer.payer_info.shipping_address.state,
            payer_info_postal_code: payment.payer.payer_info.shipping_address.postal_code,
            payer_info_country_code: payment.payer.payer_info.country_code,
            transactions_amount_total: payment.transactions[0].amount.total,
            transactions_amount_subtotal: payment.transactions[0].amount.details.subtotal,
            transactions_amount_shipping_discount: payment.transactions[0].amount.details.shipping_discount,
            transactions_description: payment.transactions[0].description,
            transactions_invoice_number: payment.transactions[0].invoice_number,
            transactions_item_list_items: payment.transactions[0].item_list.items,
            create_time: payment.create_time,
            created_by: 'Paypal',
          });
          transaction.save(async function (err) {
            try {
              const bookingInfoRaw = await Booking.findOne({
                invoiceNumber: payment.transactions[0].invoice_number,
              });
              bookingInfoRaw._doc;
              const {
                _doc: { __v, _id, ...bookingInfo },
              } = bookingInfoRaw;
              delete bookingInfo.legalNotice;
              let signUp = bookingInfo.signUp;
              delete bookingInfo.signUp;

              // console.log(bookingInfo, 'bookingInfo');

              await sendBookingEmail(bookingInfo);

              try {
                let location = await getClientLocation(req);

                const fee = payment.transactions[0].related_resources[0].sale.transaction_fee.value;
                let spreadSheetData = {
                  ...bookingInfo,
                  totalPriceDiscount: bookingInfo.totalPriceDiscount || '0%',
                  extraItems: JSON.stringify(bookingInfo.extraItems),
                  timeCreated: new Date(bookingInfo.timeCreated).toISOString().split('T')[0],
                  selectedCourseDate: new Date(bookingInfo.selectedCourseDate).toISOString().split('T')[0],
                  fee,
                  location,
                };
                spreadSheetData = parseBookingRawToSpreadsheet(spreadSheetData);
                await saveBookingToSpreadsheet({
                  spreadsheetId: bookingsSpreadsheetId,
                  selectedCourseDate: bookingInfo.selectedCourseDate,
                  values: [Object.values(spreadSheetData)],
                  keys: [Object.keys(spreadSheetData)],
                });
                await subscribeToNewsLetter(req, bookingInfo.email, signUp, {
                  firstName: bookingInfo?.firstName,
                  lastName: bookingInfo?.lastName,
                  course: bookingInfo?.selectedCourseTitle,
                  phone: bookingInfo?.phone,
                  birthday: bookingInfo?.birthday,
                  address: bookingInfo?.address,
                });
              } catch (err) {
                console.log(err, 'err trying to save spreadsheet data');
              }

              if (!err) {
                //log new transaction saved
                //console.log("new transaction saved");

                // inventory update start - look for the course sold
                var itemsPurchased = payment.transactions[0].item_list.items;
                //find the course and ignore the extra items
                for (i = 0; i < itemsPurchased.length; i++) {
                  //check if the item purchased is a course of limited places
                  if (
                    itemsPurchased[i].name.substring(0, 4) === 'RYA ' ||
                    itemsPurchased[i].name.substring(0, 4) === 'Tran' ||
                    itemsPurchased[i].name.substring(0, 4) === 'STCW'
                  ) {
                    //console.log("client purchased a course")
                    var purchasedCourseTitle = itemsPurchased[i].name;
                    //check if its a inventory course
                    if (itemsPurchased[i].description.substring(0, 6) != 'Prefer') {
                      //if not - convert unixtime to ISOtime (mongoDB date format)
                      var purchasedCourseDate = new Date(Date.parse(itemsPurchased[i].description) + 120 * 60 * 1000)
                        .toISOString()
                        .split('T')[0];
                    } else {
                      // if its a prefered date course end the function
                      var purchasedCourseDate = itemsPurchased[i].description;
                      var purchasedCourseQuantity = itemsPurchased[i].quantity;
                      //console.log("This course date is given by the client");
                      //console.log("course purchased", purchasedCourseTitle, "course date", purchasedCourseDate, "number of students", purchasedCourseQuantity)
                      return;
                    }
                    var purchasedCourseQuantity = itemsPurchased[i].quantity;
                    // log purchased course info
                    //console.log("course purchased", purchasedCourseTitle, "course date", purchasedCourseDate, "number of students", purchasedCourseQuantity)

                    //find the courses of same boat and date in datebase and update
                    if (
                      purchasedCourseTitle === 'RYA Start Yachting' ||
                      purchasedCourseTitle === 'RYA Competent Crew' ||
                      purchasedCourseTitle === 'RYA Day Skipper Practical' ||
                      purchasedCourseTitle === 'RYA Coastal Skipper Practical'
                    ) {
                      var vessel = 'Look Far - Bavaria 44 - Four cabin version';
                    } else if (
                      purchasedCourseTitle === 'Transport Malta Nautical License' ||
                      purchasedCourseTitle === 'RYA Level 1 Powerboating' ||
                      purchasedCourseTitle === 'RYA Level 2 Powerboat Handling'
                    ) {
                      var vessel = 'Powerboat';
                    } else if (
                      purchasedCourseTitle === 'RYA Start Motor Cruising' ||
                      purchasedCourseTitle === 'RYA Motor Cruising Helmsman' ||
                      purchasedCourseTitle === 'RYA Motor Cruising Day Skipper' ||
                      purchasedCourseTitle === 'RYA Motor Cruising Coastal Skipper' ||
                      purchasedCourseTitle === 'RYA Motor Cruising Advanced Pilotage'
                    ) {
                      var vessel = 'Motor Cruiser';
                    } else {
                      var vessel = 'Shorebased';
                    }
                    //console.log("vessel", vessel)
                    //find the course of same boat and time then update places left, because we usually mix studnets of different levels
                    CourseDate.find(
                      {
                        $and: [
                          {
                            vessel: vessel,
                          },
                          {
                            date: purchasedCourseDate,
                          },
                        ],
                      },
                      function (err, coursesFound) {
                        if (!err) {
                          //console.log("courses that share same vessel at same time", coursesFound);
                          //check and recalculate the inventory
                          coursesFound.forEach(function (courseFound, index) {
                            var courseId = courseFound._id;
                            var courseTitle = courseFound.title;
                            var previousAvailable = courseFound.available;
                            if (previousAvailable >= purchasedCourseQuantity) {
                              var newAvailable = previousAvailable - purchasedCourseQuantity;
                            } else {
                              var newAvailable = 0;
                            }
                            //console.log(courseTitle, "newAvailable:", newAvailable);
                            //update places left of related course
                            CourseDate.updateOne(
                              {
                                _id: courseId,
                              },
                              {
                                $set: {
                                  available: newAvailable,
                                },
                              },
                              async function (err) {
                                if (!err) {
                                  console.log('course available places updated');
                                  // update Google calendar course event with new attendees
                                  if (courseTitle === purchasedCourseTitle) {
                                    // get the exisiting attendees list from google event and add new guest
                                    //console.log("google calendar event params", params);
                                    //get event and update attendees
                                    try {
                                      await getEventAndUpdate(
                                        courseId,
                                        payment.payer.payer_info.email,
                                        payment.payer.payer_info.first_name,
                                        payment.payer.payer_info.last_name,
                                      );
                                    } catch (err) {
                                      console.log(err);
                                    }
                                  }
                                }
                              },
                            );
                          });
                        }
                      },
                    );
                  } else {
                    //console.log("an extra item was purchased");
                  }
                }
              } else {
                //console.log("transaction could not be saved")
                res.send(err);
              }
            } catch (err) {
              console.log(err);
            }
          });
        } else {
          //console.log("payment details could not be saved")
          res.send(err);
        }
      });
    }
  });
});

// 3. Handle payment-success to trigger google analytics event.
app.get('/payment-success', (req, res) => {
  res.render(`partials/payment-success`);
});

// 4. handle failed Paypal payment
app.get('/booking/paypal-pay/cancel', function (req, res) {
  res.render('partials/payment-failure');
});

// 5. Handle create payment intent from stripe. Created when user clicks on the stripe button
app.post('/booking/create-payment-intent', async (req, res) => {
  // Create a PaymentIntent with the order amount and currency

  try {
    const { applicantInfo, courseItem, extraItems, ...rest } = req.body;
    // console.log(extraItems, 'extraItems');
    if (!req.body.price) {
      return res.status(400).send('error');
    }

    const payment = await stripe.paymentIntents.create({
      amount: req.body.price ? req.body.price * 100 : 0,
      metadata: {
        applicantInfo: JSON.stringify(req.body.applicantInfo),
        courseItem: JSON.stringify(req.body.courseItem),
        extraItems: extraItems ? JSON.stringify(extraItems) : null,
        ...rest,
      },
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: req.body.applicantInfo.email,
    });
    // console.log(payment.metadata)
    res.status(200).json({
      clientSecret: payment.client_secret,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// 6. Render success page with stripe keyto handle payment
app.get('/booking/stripe/success', function (req, res) {
  res.redirect(`/payment-success?payment_intent_client_secret=${req.query['payment_intent_client_secret']}`);
});

// 7. In partials/payment-success, handle confirm payment intent from stripe. Created when the user have paid and /success partial is rendered
app.post('/booking/confirm-payment-intent', async (req, res) => {
  try {
    const paymentSecret = req.body.paymentSecret;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentSecret, {
      expand: ['charges.data.balance_transaction'],
    });

    let details = paymentIntent.metadata;
    console.log(details, 'details');
    let { applicantInfo, courseItem, extraItems, ...rest } = details;
    console.log(rest, 'rest');
    // console.log(extraItems, 'extraItems');
    extraItems = JSON.parse(extraItems);
    applicantInfo = JSON.parse(applicantInfo);
    courseItem = JSON.parse(courseItem);
    details.applicantInfo = applicantInfo;
    details.courseItem = courseItem;
    details.extraItems = extraItems;
    let bookingInfo = null;
    try {
      const invoiceNumber = 'SSM' + (Math.floor(Math.random() * 9000000000) + 10000000);
      details.invoiceNumber = invoiceNumber;
      if (details.total != null) {
        bookingInfo = await createBookingStripe(details);
      }
      let signUp = bookingInfo.signUp;
      delete bookingInfo.signUp;

      if (paymentIntent.status === 'succeeded') {
        const charge = paymentIntent.charges.data[0];
        const transactionFound = await Transaction.findOne({ id: charge.id });

        if (transactionFound) {
          return res.status(400).json({
            message: 'Booking already exists',
            transactionFound,
            charge,
          });
        }
        try {
          await processSuccessfullPaymentStripe(invoiceNumber, details.timeCreated, details, charge);

          if (bookingInfo && charge.status === 'succeeded') {
            //We will only store the booking if the payment was successful, not unpaid

            await sendBookingEmail(bookingInfo);

            let location = await getClientLocation(req);

            let spreadSheetData = {
              ...bookingInfo,
              extraItems: JSON.stringify(bookingInfo.extraItems),
              timeCreated: new Date(bookingInfo.timeCreated).toISOString().split('T')[0],
              selectedCourseDate: new Date(bookingInfo.selectedCourseDate).toISOString().split('T')[0],
              fee: charge.balance_transaction.fee / 100,
              location,
            };

            spreadSheetData = parseBookingRawToSpreadsheet(spreadSheetData);

            await saveBookingToSpreadsheet({
              spreadsheetId: bookingsSpreadsheetId,
              selectedCourseDate: bookingInfo.selectedCourseDate,
              values: [Object.values(spreadSheetData)],
              keys: [Object.keys(spreadSheetData)],
            });
            await subscribeToNewsLetter(req, bookingInfo.email, signUp, {
              firstName: bookingInfo.firstName,
              lastName: bookingInfo.lastName,
              course: bookingInfo.selectedCourseTitle,
              phone: bookingInfo.phone,
              birthday: bookingInfo.birthday,
              address: bookingInfo.address,
            });
          }
        } catch (err) {
          console.log(err);
        }
      }
    } catch (err) {
      console.log(err);
    }
    return res.status(200).json({ applicantInfo, courseItem, ...rest, paymentIntent });
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

// 8. Handle error at payment
app.post('/booking/stripe/error', async function (req, res) {
  try {
    const paymentSecret = req.body.paymentSecret;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentSecret);

    let details = paymentIntent.metadata;
    // console.log(details, 'details');
    let { applicantInfo, courseItem, extraItems, ...rest } = details;
    extraItems = JSON.parse(extraItems);
    applicantInfo = JSON.parse(applicantInfo);
    courseItem = JSON.parse(courseItem);
    details.applicantInfo = applicantInfo;
    details.courseItem = courseItem;
    details.extraItems = extraItems;
    try {
      if (details.total != null) {
        await createBookingStripe(details);
      }
      return res.status(200).json({ paymentIntent });
    } catch (err) {
      console.log(err);
      return res.status(500).send(err);
    }
  } catch (err) {
    return res.status(500).send(err);
  }
});

// 9. render manually create new booking page (need Authorization)
app.get('/booking/booking/create', function (req, res) {
  if (req.isAuthenticated()) {
    CourseDate.find({}, function (err, coursesFound) {
      if (!err) {
        let futureCourses = [];
        coursesFound.forEach(function (course, index) {
          var today = new Date();
          if (course.date > today) {
            futureCourses.push(course);
          }
        });
        let soretedfutureCourses = futureCourses.sort((a, b) => a.courseDate - b.courseDate);

        ExtraItem.find({}, function (err, extraItemsFound) {
          if (!err) {
            res.render('create-booking', {
              soretedfutureCourses: soretedfutureCourses,
              extraItemsFound: extraItemsFound,
            });
          }
        });
      }
    });
  } else {
    res.redirect('/login');
  }
});

// 10. save new manually created booking and update left places and attendees (need Authorization)
app.post('/booking/booking/create', function (req, res) {
  if (req.isAuthenticated()) {
    //console.log(req.body);
    const booking = new Booking(req.body);
    booking.save(function (err) {
      if (err) {
        console.log(err);
      }
    });
    //reformate date type
    var purchasedCourseDate = new Date(Date.parse(req.body.selectedCourseDate) + 120 * 60 * 1000).toISOString();
    var purchasedCourseTitle = req.body.selectedCourseTitle;
    //find the courses of same boat and date in datebase and update
    if (
      purchasedCourseTitle === 'RYA Start Yachting' ||
      purchasedCourseTitle === 'RYA Competent Crew' ||
      purchasedCourseTitle === 'RYA Day Skipper Practical' ||
      purchasedCourseTitle === 'RYA Coastal Skipper Practical'
    ) {
      var vessel = 'Look Far - Bavaria 44 - Four cabin version';
    } else if (
      purchasedCourseTitle === 'Transport Malta Nautical License' ||
      purchasedCourseTitle === 'RYA Level 1 Powerboating' ||
      purchasedCourseTitle === 'RYA Level 2 Powerboat Handling'
    ) {
      var vessel = 'Powerboat';
    } else if (
      purchasedCourseTitle === 'RYA Start Motor Cruising' ||
      purchasedCourseTitle === 'RYA Motor Cruising Helmsman' ||
      purchasedCourseTitle === 'RYA Motor Cruising Day Skipper' ||
      purchasedCourseTitle === 'RYA Motor Cruising Coastal Skipper' ||
      purchasedCourseTitle === 'RYA Motor Cruising Advanced Pilotage'
    ) {
      var vessel = 'Motor Cruiser';
    } else {
      var vessel = 'Shorebased';
    }
    //console.log(purchasedCourseTitle, purchasedCourseDate, vessel);
    //find the course of same boat and time then update places left, because we usually mix studnets of different levels
    CourseDate.find(
      {
        $and: [
          {
            vessel: vessel,
          },
          {
            date: purchasedCourseDate,
          },
        ],
      },
      function (err, coursesFound) {
        if (!err) {
          //console.log("courses that share same vessel at same time", coursesFound);
          //check and recalculate the inventory
          coursesFound.forEach(function (courseFound, index) {
            var courseId = courseFound._id;
            var courseTitle = courseFound.title;
            var previousAvailable = courseFound.available;
            var purchasedCourseQuantity = req.body.numberOfPeople;
            if (previousAvailable >= purchasedCourseQuantity) {
              var newAvailable = previousAvailable - purchasedCourseQuantity;
            } else {
              var newAvailable = 0;
            }
            //console.log(courseTitle, "newAvailable:", newAvailable);
            //update places left of the course
            CourseDate.updateOne(
              {
                _id: courseId,
              },
              {
                $set: {
                  available: newAvailable,
                },
              },
              function (err) {
                if (!err) {
                  //console.log("course available places updated");
                  // update Google calendar course event with new attendees
                  if (courseTitle === purchasedCourseTitle) {
                    // get the exisiting attendees list from google event and add new guest
                    var eventId = courseId.toString();
                    var params = {
                      calendarId: 'primary',
                      eventId: eventId,
                    };
                    //console.log(params);
                    //get event and update attendees
                    getEventAndUpdate();
                    async function getEventAndUpdate() {
                      var res = await calendar.events.get(params);
                      const event = res.data;
                      //console.log(event);
                      if (event.attendees === undefined) {
                        var attendees = [
                          {
                            email: req.body.email,
                            displayName: req.body.firstName + req.body.lastName,
                          },
                        ];
                        //console.log(attendees);
                      } else {
                        var attendees = event.attendees;
                        attendees.push({
                          email: req.body.email,
                          displayName: req.body.firstName + req.body.lastName,
                        });
                      }
                      // Preparation for patch
                      const updateEvent = {
                        updated: new Date(),
                        attendees: attendees,
                        status: 'confirmed',
                      };
                      //console.log(updateEvent);
                      params = {
                        calendarId: 'primary',
                        eventId: eventId,
                        resource: updateEvent,
                      };
                      //console.log(params);
                      calendar.events.patch(params, function (err) {
                        if (err) {
                          //console.log('The API returned an error: ' + err);
                          return;
                        } else {
                          //console.log('Event updated');
                          return;
                        }
                      });
                    }
                  }
                }
              },
            );
          });
        }
      },
    );
    res.redirect('/console');
  } else {
    res.redirect('/login');
  }
});

// 11. render manually create new transactions page (need Authorization)
app.get('/booking/transaction/create', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('create-transaction');
  } else {
    res.redirect('/login');
  }
});

// 12. save manually recorded transaction (need Authorization)
app.post('/booking/transaction/create', function (req, res) {
  if (req.isAuthenticated()) {
    const transaction = new Transaction(req.body);
    transaction.save(function (err) {
      if (err) {
        console.log(err);
      } else {
        //console.log("transaction saved")
        res.redirect('/console');
      }
    });
  } else {
    res.redirect('/login');
  }
});

// 13. generate application fomr pdf (need Authorization)
app.get('/booking/booking-form/:id', function (req, res) {
  if (req.isAuthenticated()) {
    var id = req.params.id;
    Booking.findOne(
      {
        _id: id,
      },
      function (err, bookingFound) {
        if (!err) {
          res.render('booking-form', {
            bookingFound: bookingFound,
          });
        } else {
          console.log(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 14. generate inovice pdf (need Authorization)
app.get('/booking/invoice/:id', function (req, res) {
  if (req.isAuthenticated()) {
    var id = req.params.id;
    Transaction.findOne(
      {
        _id: id,
      },
      function (err, transactionFound) {
        if (!err) {
          res.render('invoice-form', {
            transactionFound: transactionFound,
          });
        } else {
          console.log(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 15. get payment details in JSON Tree
app.get('/booking/check-payment-detail/:id', function (req, res) {
  if (req.isAuthenticated()) {
    let id = req.params.id;
    Payment.findOne(
      {
        id: id,
      },
      function (err, paymentFound) {
        if (paymentFound != null) {
          res.send(paymentFound.paymentDetails);
        } else {
          Transaction.findOne(
            {
              id: id,
            },
            function (err, transactionFound) {
              if (!err) {
                res.render('invoice-form', {
                  transactionFound: transactionFound,
                });
              } else {
                console.log(err);
              }
            },
          );
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 16. payment functions helpers for stripe.
async function createBookingStripe(details) {
  console.log(details);
  const bookingInfo = {
    firstName: details.applicantInfo.firstName,
    lastName: details.applicantInfo.lastName,
    email: details.applicantInfo.email,
    phone: details.applicantInfo.phone,
    birthday: details.applicantInfo.birthday,
    address: details.applicantInfo.address,
    country: details.applicantInfo.country,
    city: details.applicantInfo.city,
    state: details.applicantInfo.state,
    zip: details.applicantInfo.zip,
    legalNotice: details.applicantInfo.legalNotice,
    signUp: details.applicantInfo.signUp,
    selectedCourseTitle: details.courseItem.title,
    selectedCourseDate: details.courseItem.date,
    preferedCourseDate: details.courseItem.preferedDate,
    selectedCourseUnitPrice: details.courseItem.price,
    numberOfPeople: details.courseItem.quantity,
    extraItems: details.extraItems,
    totalPriceDiscount: details.discount,
    totalBeforeDiscount: details.subtotal,
    discountAmount: details.discountAmount,
    paymentAmount: details.total,
    invoiceNumber: details.invoiceNumber,
    timeCreated: details.timeCreated,
    creator: 'Stripe',
  };
  try {
    const booking = new Booking(bookingInfo);
    const bookingSaved = await booking.save();
    // console.log(bookingSaved, 'booking saved');
  } catch (err) {
    console.log(err, 'booking save error');
  }
  delete bookingInfo.legalNotice;
  return bookingInfo;
}
async function processSuccessfullPaymentStripe(invoiceNumber, timeCreated, details, payment) {
  savePaymentStripe(payment);
  //create transaction and save
  saveTransactionStripe(payment, details, invoiceNumber, timeCreated);

  // inventory update start - look for the course sold
  if (details.courseItem.title != '') {
    var purchasedCourseTitle = details.courseItem.title;
    if (details.courseItem.date.substring(0, 6) != 'Prefer') {
      //if not - convert unixtime to ISOtime (mongoDB date format) 2022-12-01
      var purchasedCourseDate = new Date(Date.parse(details.courseItem.date) + 120 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    } else {
      // if its a prefered date course end the function
      var purchasedCourseDate = details.courseItem.preferedDate;
      var purchasedCourseQuantity = details.courseItem.quantity;
      return;
    }
    var purchasedCourseQuantity = details.courseItem.quantity;
    // log purchased course info
    // //console.log("course purchased", purchasedCourseTitle, "course date", purchasedCourseDate, "number of students", purchasedCourseQuantity)

    //find the courses of same boat and date in datebase and update
    if (
      purchasedCourseTitle === 'RYA Start Yachting' ||
      purchasedCourseTitle === 'RYA Competent Crew' ||
      purchasedCourseTitle === 'RYA Day Skipper Practical' ||
      purchasedCourseTitle === 'RYA Coastal Skipper Practical'
    ) {
      var vessel = 'Look Far - Bavaria 44 - Four cabin version';
    } else if (
      purchasedCourseTitle === 'Transport Malta Nautical License' ||
      purchasedCourseTitle === 'RYA Level 1 Powerboating' ||
      purchasedCourseTitle === 'RYA Level 2 Powerboat Handling'
    ) {
      var vessel = 'Powerboat';
    } else if (
      purchasedCourseTitle === 'RYA Start Motor Cruising' ||
      purchasedCourseTitle === 'RYA Motor Cruising Helmsman' ||
      purchasedCourseTitle === 'RYA Motor Cruising Day Skipper' ||
      purchasedCourseTitle === 'RYA Motor Cruising Coastal Skipper' ||
      purchasedCourseTitle === 'RYA Motor Cruising Advanced Pilotage'
    ) {
      var vessel = 'Motor Cruiser';
    } else {
      var vessel = 'Shorebased';
    }
    // //console.log("vessel", vessel)
    //find the course of same boat and time then update places left, because we usually mix studnets of different levels
    CourseDate.find(
      {
        $and: [
          {
            vessel: vessel,
          },
          {
            date: purchasedCourseDate,
          },
        ],
      },
      function (err, coursesFound) {
        if (!err) {
          // //console.log("courses that share same vessel at same time", coursesFound);
          //check and recalculate the inventory
          coursesFound.forEach(function (courseFound, index) {
            var courseId = courseFound._id;
            var courseTitle = courseFound.title;
            var previousAvailable = courseFound.available;
            if (previousAvailable >= purchasedCourseQuantity) {
              var newAvailable = previousAvailable - purchasedCourseQuantity;
            } else {
              var newAvailable = 0;
            }
            //console.log(courseTitle, "newAvailable:", newAvailable);
            //update places left of the course
            CourseDate.updateOne(
              {
                _id: courseId,
              },
              {
                $set: {
                  available: newAvailable,
                },
              },
              async function (err) {
                if (!err) {
                  console.log('course available places updated');
                  // update Google calendar course event with new attendees
                  if (courseTitle === purchasedCourseTitle) {
                    // get the exisiting attendees list from google event and add new guest
                    var eventId = courseId.toString();
                    var params = {
                      calendarId: 'primary',
                      eventId: eventId,
                    };
                    // console.log("params of corresponding google calendar event", params);
                    //get event and update attendees
                    try {
                      console.log(params, 'params');
                      await getEventAndUpdate(
                        courseId,
                        details.applicantInfo.email,
                        details.applicantInfo.firstName,
                        details.applicantInfo.lastName,
                      );
                    } catch (err) {
                      console.log('error', err);
                    }
                  }
                } else {
                  console.log(err);
                }
              },
            );
          });
        }
      },
    );
  } else {
    //console.log("no course item purchased, but another product or service")
    return;
  }
}
function saveTransactionStripe(payment, details, invoiceNumber, timeCreated) {
  const transactionObj = {
    id: payment.id,
    state: payment.status,
    cart: payment.receipt_url,
    payment_method: payment.payment_method_details.type,
    payer_info_email: details.applicantInfo.email,
    payer_info_first_name: details.applicantInfo.firstName,
    payer_info_last_name: details.applicantInfo.lastName,
    payer_info_id: '',
    payer_info_address: payment.billing_details.address.line1 + payment.billing_details.address.line2,
    payer_info_city: payment.billing_details.address.city,
    payer_info_state: payment.billing_details.address.state,
    payer_info_postal_code: payment.billing_details.address.postal_code,
    payer_info_country_code: payment.billing_details.address.country,
    transactions_amount_total: (payment.amount / 100).toFixed(2),
    transactions_amount_subtotal: 'n.a',
    transactions_amount_shipping_discount: 'n.a.',
    transactions_description: payment.description,
    transactions_invoice_number: invoiceNumber,
    transactions_item_list_items: [],
    create_time: timeCreated,
    created_by: 'Stripe',
  };
  const transaction = new Transaction(transactionObj);
  transaction.save(async function (err, transactionSaved) {
    if (!err) {
      //log new transaction saved
    }
  });
}
function savePaymentStripe(payment) {
  var paymentDetails_string = JSON.stringify(payment);
  //log returned payment information
  //save payment string to datebase
  const paymentDetails = new Payment({
    id: payment.id,
    paymentDetails: paymentDetails_string,
  });
  paymentDetails.save(function (err) {
    if (!err) {
      //console.log("payment info saved");
    }
  });
}

// 17. Spreadsheet function helpers for both stripe and paypal
function parseBookingRawToSpreadsheet(bookingInfo) {
  const selectedCourseDate = new Date(bookingInfo.selectedCourseDate);
  selectedCourseDate.setDate(selectedCourseDate.getDate() + 1);
  return {
    'Course Title': bookingInfo.selectedCourseTitle,
    'Selected Course Date': selectedCourseDate.toISOString().split('T')[0],
    'Prefered Course Date': bookingInfo.preferedCourseDate,
    Status: 'paid',
    Name: bookingInfo.firstName,
    Surname: bookingInfo.lastName,
    Email: bookingInfo.email,
    Phone: bookingInfo.phone.toString().replaceAll(' ', ''),
    Note: bookingInfo.extraItems,
    'Course Unit Price': bookingInfo.selectedCourseUnitPrice,
    'No. People': bookingInfo.numberOfPeople,
    'Total Before Discount': bookingInfo.totalBeforeDiscount,
    Discount: bookingInfo.totalPriceDiscount,
    'Discount Amount': bookingInfo.discountAmount,
    'Payment Amount': bookingInfo.paymentAmount,
    'Amount Paid': bookingInfo.paymentAmount,
    'Pending Amount': 0,
    'Refunded Amount': 0,
    Fee: bookingInfo.fee,
    Channel: bookingInfo.creator,
    'Invoice Number': bookingInfo.invoiceNumber,
    Country: bookingInfo.country,
    City: bookingInfo.city,
    State: bookingInfo.state,
    Address: bookingInfo.address,
    Zip: bookingInfo.zip,
    'IP Location': bookingInfo.location,
    'Time Created': bookingInfo.timeCreated,
  };
}
async function saveBookingToSpreadsheet({ spreadsheetId, selectedCourseDate, values, keys }) {
  console.log('updating spreadsheet');
  const googleSheetsInstance = google.sheets({
    version: 'v4',
    auth: oAuth2Client,
  });
  const parsedDate = new Date(selectedCourseDate);
  const monthStart = parsedDate.toLocaleDateString('en', { month: 'short' });
  const year = parsedDate.getFullYear();
  const sheetTitle = `${monthStart} ${year}`;
  const {
    data: { sheets },
  } = await googleSheetsInstance.spreadsheets.get({
    spreadsheetId,
  });

  let existingSheet = sheets.find((sheet) => sheet.properties.title === sheetTitle);
  if (!existingSheet) {
    existingSheet = await googleSheetsInstance.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      },
    });

    await googleSheetsInstance.spreadsheets.values.append({
      auth: oAuth2Client, //auth object
      spreadsheetId, //spreadsheet id
      range: sheetTitle, //sheet name and range of cells
      valueInputOption: 'USER_ENTERED', // The information will be passed according to what the usere passes in as date, number or text
      resource: {
        values: keys,
      },
    });
  }

  //The resource object has a child value, which is an array of the data to be entered into the sheets.
  //The array length depends on the number of columns of the spreadsheet.
  const addedSheet = await googleSheetsInstance.spreadsheets.values.append({
    auth: oAuth2Client, //auth object
    spreadsheetId, //spreadsheet id
    range: sheetTitle, //sheet name and range of cells
    valueInputOption: 'USER_ENTERED', // The information will be passed according to what the usere passes in as date, number or text
    resource: {
      values: values,
    },
  });
  // console.log('successfull', addedSheet);
  // console.log(test.data, 'data');

  await setSheetRowBackground(
    { addedSheet, googleSheetsInstance, spreadsheetId, existingSheet, values },
    {
      red: 207,
      green: 226,
      blue: 243,
    },
  );
}
async function setSheetRowBackground(
  { addedSheet, googleSheetsInstance, spreadsheetId, existingSheet, values },
  { red, green, blue },
) {
  try {
    const [startRowIndex] = addedSheet.data.updates.updatedRange.split(/!/)[1].split(/\D/).filter(Boolean);

    await googleSheetsInstance.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId: existingSheet?.properties?.sheetId,
              dimension: 'ROWS',
              length: 3,
            },
          },
          {
            updateCells: {
              range: {
                sheetId: existingSheet.properties.sheetId,
                startRowIndex: startRowIndex - 1,
                endRowIndex: startRowIndex,
                startColumnIndex: 0,
                endColumnIndex: values[0].length,
              },
              rows: [
                {
                  values: Array.from({ length: values[0].length }, () => ({
                    userEnteredFormat: {
                      backgroundColor: {
                        red: red / 255,
                        green: green / 255,
                        blue: blue / 255,
                      },
                    },
                  })),
                },
              ],
              fields: 'userEnteredFormat.backgroundColor',
            },
          },
        ],
      },
    });
  } catch (err) {
    console.log(err);
    console.log('couldnt apply colors');
  }
}
async function getClientLocation(req) {
  let location = '';
  if (process.env.NODE_ENV !== 'development') {
    try {
      const ip = req.clientIp;
      console.log(ip);
      const {
        location: {
          country: { name },
          city,
        },
      } = await (
        await fetch(`https://api.ipregistry.co/${ip}?key=jsotkru4e9vdli1d&fields=location.country.name,location.city`, {
          method: 'GET',
        })
      ).json();
      location = `${city}, ${name}`;
      console.log(location);
    } catch (err) {
      console.log(err);
    }
  }

  return location;
}

// 18. Add attendee to calendar
async function getEventAndUpdate(courseId, email, firstName, lastName) {
  try {
    var eventId = courseId.toString();
    var params = {
      calendarId: 'primary',
      eventId: eventId,
    };
    var res = await calendar.events.get(params);
    const event = res.data;
    console.log(event, 'event');
    if (event.attendees === undefined) {
      var attendees = [
        {
          email,
          displayName: `${firstName} ${lastName}`,
        },
      ];
      console.log('new attendees', attendees);
    } else {
      var attendees = event.attendees;
      console.log(attendees);
      attendees.push({
        email,
        displayName: `${firstName} ${lastName}`,
      });
      // //console.log("new attendees", attendees);
    }
    // Preparation for patch
    const updateEvent = {
      updated: new Date(),
      attendees: attendees,
      status: 'confirmed',
    };
    //   //console.log("updateEvent", updateEvent);
    params = {
      calendarId: 'primary',
      eventId: eventId,
      resource: updateEvent,
    };
    calendar.events.patch(params, function (err) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      } else {
        console.log('Event updated');
        return;
      }
    });
  } catch (err) {
    console.log(err);
  }
}

// 19. Send email function helper
async function sendBookingEmail(bookingInfo) {
  try {
    const myAccessToken = oAuth2Client.getAccessToken();

    let transporter = nodemailer.createTransport({
      service: 'gmail',
      secure: false, // true for 465, false for other ports
      tls: {
        rejectUnauthorized: false, //if sending from localhost, set false
      },
      auth: {
        type: 'OAuth2',
        user: nodeMailerEmailAddress,
        clientId: googleClientID,
        clientSecret: googleClientSecret,

        refreshToken: googleRefreshToken,
        accessToken: myAccessToken,
      },
    });
    await transporter.sendMail({
      from: '"Sailing School Malta" <' + nodeMailerEmailAddress + '>', // sender address
      to: bookingInfo.email, // list of receivers
      subject: 'Sailing School Malta Course Booking Notification', // Subject line
      html: `
        <p>
        Hi ${bookingInfo.firstName},
        </p>
        <p>
        Thanks for booking the ${bookingInfo.selectedCourseTitle} course.
        </p>
        <p>
        If you booked an RYA sailing course, please download and check the 
        <a href="https://www.sailingschoolmalta.com/files/4a6b060d99f0bbc04a71849a0df1da51.pdf">Course Joining Instruction.</a>
        </p>
        <p>
        Important!: For anyone who booked and will join an RYA course, we would kindly ask you to complete the 
        <a href="https://www.sailingschoolmalta.com/files/28e396d36e683f8b6ed5a2b04cfa0320.pdf ">RYA Course Application Form</a>
        and send it back to info@sailingschoolmalta.com. It’s an editable PDF, you don't need to print it out. This form is required by RYA to issue certificate.
        </p>
        <p>
        If you booked Transport Malta Nautical Licence course (or exam), please download and fill the
        <a href="https://www.sailingschoolmalta.com/files/b747687bc863aa9ac31890c9de9f8ad9.pdf">Application Form</a> and
        <a href="https://www.sailingschoolmalta.com/files/c1332a4aab55e1d55c0382bb16ec910e.pdf">Medical Fitnessform</a>, then send them to stephen@sailingschoolmalta.com after you complete the course.
        </p>
        <p>
        If you booked Transport Malta Nautical Licence course or RYA Powerboat course, we will send you a joining instruction when the course date is closer. Please keep an eye on the spam mail box in case our email reaches there. The instructor will also send you some practical session time slots for you to choose from.
        </p>
        <p>
        If there is any change or update related to your booked course, we will notice you inmediately with an email.
        </p>
        <p>
        If you have questions, please check the 
        <a href="https://www.sailingschoolmalta.com/faqs"> FAQ section</a> 
        or email us info@sailingschoolmalta.com
        </a>
        </p>
        <p>
        Regards,
        </p>
        <p>
        Sailing School Malta Team
        </p>
        `, // html body
    });
  } catch (err) {
    console.log(err, 'err sending email');
  }
}

/////////////////////////////////////Blog System///////////////////////////////

// 0. render blog index page
app.get('/blog', function (req, res) {
  Post.find({}, function (err, postsFound) {
    if (!err) {
      let orderedPostsFounds = postsFound.sort((a, b) => b.date - a.date);
      res.render('blog', {
        postsFound: postsFound,
      });
    }
  });
});

// 1. render individual post page
app.get('/blog/:postId', function (req, res) {
  const requestedPostID = req.params.postId;
  Post.findOne(
    {
      _id: requestedPostID,
    },
    async function (err, postFound) {
      if (postFound) {
        res.render('post', {
          post: postFound,
          domain: domain,
          pictures: postFound?.image?.filter(Boolean) || [],
        });
      } else {
        res.status(404).send('Not found post <a href="/">Go back</a>');
      }
    },
  );
});

// 2. render post post of a category page
app.get('/blog/category/:category', function (req, res) {
  const requestedCategory = req.params.category;
  Post.find(
    {
      category: requestedCategory,
    },
    function (err, postsFound) {
      if (!err) {
        let orderedPostsFounds = postsFound.sort((a, b) => b.date - a.date);
        res.render('blog', {
          postsFound: postsFound,
        });
      }
    },
  );
});

// 3. compose new post page (need Authorization)
app.get('/blog/post/create', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('create-post');
  } else {
    res.redirect('/login');
  }
});

// 4. creat and save new article to database (need Authorization)
app.post('/blog/post/create', function (req, res) {
  if (req.isAuthenticated()) {
    const post = new Post({
      image: req.body.images,
      title: req.body.title,
      subtitle: req.body.subtitle,
      date: req.body.date,
      author: req.body.author,
      category: req.body.category,
      content: req.body.content,
    });

    post.save(function (err, savedPost) {
      if (!err) {
        res.redirect('/blog/' + savedPost._id);
      } else {
        res.send(err);
      }
    });
  } else {
    res.redirect('/login');
  }
});

// 5. render edit specific post page (need Authorization)
app.get('/blog/post/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    let id = req.params.id;

    Post.findOne(
      {
        _id: id,
      },
      function (err, postFound) {
        if (!err) {
          res.render('edit-post', {
            postFound: postFound,
          });
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 6. update specific post in database (need Authorization)
app.post('/blog/post/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    Post.updateOne(
      {
        _id: req.params.id,
      },
      {
        $set: req.body,
      },
      function (err) {
        if (!err) {
          res.redirect('/blog/' + req.params.id);
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 7. delete specific post in database (need Authorization)
app.post('/blog/post/delete/:id', function (req, res) {
  if (req.isAuthenticated()) {
    Post.deleteOne(
      {
        _id: req.params.id,
      },
      function (err) {
        if (!err) {
          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

////////////////////////////Shop & Coupon & Promotion System////////////////////

// 0. render shop page
app.get('/shop', function (req, res) {
  ExtraItem.find({}, function (err, extraItemsFound) {
    if (!err) {
      res.render('shop', {
        extraItemsFound: extraItemsFound,
      });
    } else {
      console.log(err);
    }
  });
});

// 1. render create an extra item page (need Authorization)
app.get('/shop/extra-item/create', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('create-extra-item');
  } else {
    res.redirect('/login');
  }
});

// 2. create and save an extra item to database (need Authorization)
app.post('/shop/extra-item/create', function (req, res) {
  if (req.isAuthenticated()) {
    //console.log(req.body)
    const extraItem = new ExtraItem({
      name: req.body.name,
      price: req.body.price,
      unit: req.body.unit,
      inventory: req.body.inventory,
      category: req.body.category,
      description: req.body.description,
      images: req.body.images,
      applicableCourses: req.body.applicableCourses,
    });

    extraItem.save(function (err) {
      if (!err) {
        //console.log("new extra item saved")
        res.redirect('/console');
      } else {
        res.send(err);
      }
    });
  } else {
    res.redirect('/login');
  }
});

// 3. render edit specific extra item page (need Authorization)
app.get('/shop/extra-item/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    let id = req.params.id;

    ExtraItem.findOne(
      {
        _id: id,
      },
      function (err, extraItemFound) {
        if (!err) {
          res.render('edit-extra-item', {
            extraItemFound: extraItemFound,
          });
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 4. update specific extra item in database (need Authorization)
app.post('/shop/extra-item/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    ExtraItem.updateOne(
      {
        _id: req.params.id,
      },
      {
        $set: req.body,
      },
      function (err) {
        if (!err) {
          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 5. delete specific extraitem in database (need Authorization)
app.post('/shop/extra-item/delete/:id', function (req, res) {
  if (req.isAuthenticated()) {
    ExtraItem.deleteOne(
      {
        _id: req.params.id,
      },
      function (err) {
        if (!err) {
          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 6. render create coupon page (need Authorization)
app.get('/shop/coupon/create', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('create-coupon');
  } else {
    res.redirect('/login');
  }
});

// 7. create and save a new coupon to database (need Authorization)
app.post('/shop/coupon/create', function (req, res) {
  if (req.isAuthenticated()) {
    const coupon = new Coupon({
      coupon: req.body.coupon,
      discount: req.body.discount,
      expiration: req.body.expiration,
    });

    coupon.save(function (err) {
      if (!err) {
        //console.log("new coupon saved")
        res.redirect('/console');
      } else {
        res.send(err);
      }
    });
  } else {
    res.redirect('/login');
  }
});

// 8. render create promotion page (need Authorization)
app.get('/shop/promotion', function (req, res) {
  Promotion.find({}, function (err, promotionsFound) {
    if (!err) {
      var validPromotions = [];
      var today = new Date();
      promotionsFound.forEach(function (promotion, index) {
        if (promotion.expiration > today) {
          validPromotions.push(promotion);
        }
      });

      const sortedValidPromotions = validPromotions.sort(
        (a, b) => new Date(b.launchedTime).getTime() - new Date(a.launchedTime).getTime(),
      );

      res.render('promotion', {
        promotionsFound: sortedValidPromotions,
      });
    }
  });
});

// 9. render create promotion page (need Authorization)
app.get('/shop/promotion/create', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('create-promotion');
  } else {
    res.redirect('/login');
  }
});

// 10. create and save a new promotion to database (need Authorization)
app.post('/shop/promotion/create', function (req, res) {
  if (req.isAuthenticated()) {
    const promotion = new Promotion(req.body);

    promotion.save(function (err) {
      if (!err) {
        //console.log("new promotion saved")
        res.redirect('/console');
      } else {
        res.send(err);
      }
    });
  } else {
    res.redirect('/login');
  }
});

// 11. render edit specific promotion page (need Authorization)
app.get('/shop/promotion/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    let id = req.params.id;

    Promotion.findOne(
      {
        _id: id,
      },
      function (err, promotionFound) {
        if (!err) {
          res.render('edit-promotion', {
            promotionFound: promotionFound,
          });
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 12. update specific promotion in database (need Authorization)
app.post('/shop/promotion/edit/:id', function (req, res) {
  if (req.isAuthenticated()) {
    Promotion.updateOne(
      {
        _id: req.params.id,
      },
      {
        $set: req.body,
      },
      function (err) {
        if (!err) {
          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 13. delete specific promotion in database (need Authorization)
app.post('/shop/promotion/delete/:id', function (req, res) {
  if (req.isAuthenticated()) {
    Promotion.deleteOne(
      {
        _id: req.params.id,
      },
      function (err) {
        if (!err) {
          res.redirect('/console');
        } else {
          res.send(err);
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

//////////////////////////////////File Upload System///////////////////////////

// 1. render upload file page (need Authorization)
app.get('/upload', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('upload', {
      files: false,
    });
  } else {
    res.redirect('/login');
  }
});

// 2. upload the image to the database and log the upload info then return to upload page with uploade file (need Authorization)
app.post('/upload', upload.array('files'), async function (req, res) {
  if (req.isAuthenticated()) {
    req.files.forEach((file) => {
      new Upload({
        id: file.id,
        filename: file.filename,
        category: req.body.category,
        description: req.body.description,
        contentType: file.contentType,
        uploadDate: file.uploadDate,
      }).save();
    });
    const filesImgs = [];
    const files = await gfs.files.find({
      filename: { $in: req.files.map((file) => file.filename) },
    });
    if (!files || files.length === 0) {
      res.render('upload', {
        files: false,
      });
    }

    Promise.resolve(
      files.forEach(({ filename, _id, contentType }) => {
        filesImgs.push({
          filename,
          _id,
          isImage: contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/gif',
        });
      }),
    ).then(() => {
      res.render('upload', {
        files: filesImgs,
      });
    });
  } else {
    res.redirect('/login');
  }
});

// 3. check all the uploaded files in database and render them in JSON Tree (need Authorization)
app.get('/files', function (req, res) {
  if (req.isAuthenticated()) {
    gfs.files.find().toArray(function (err, files) {
      if (!files || files.length === 0) {
        return res.status(404).json({
          err: 'No files exisit',
        });
      } else return res.json(files);
    });
  } else {
    res.redirect('/login');
  }
});

// 4. open a single file
app.get('/files/:filename', function (req, res) {
  gfs.files.findOne(
    {
      filename: req.params.filename,
    },
    function (err, file) {
      // Check if file exists
      if (!file || file.length === 0) {
        return res.status(404).json({
          err: 'No file exists',
        });
      }
      // if the file is a picture, open it
      else if (
        file.contentType === 'image/jpeg' ||
        file.contentType === 'image/png' ||
        file.contentType === 'image/gif'
      ) {
        const readStream = gfs.createReadStream(file.filename);
        readStream.pipe(res);
      }
      // if the file is a pdf, open it
      else if (file.contentType === 'application/pdf') {
        const readStream = gfs.createReadStream(file.filename);
        readStream.pipe(res);
      }
      // other file exists
      else {
        return res.json(file);
      }
    },
  );
});

// 5. render all uploaded images and files in database
app.get('/images', function (req, res) {
  if (req.isAuthenticated()) {
    // if isAuthenticated, can view and delete
    Upload.find({}, function (err, files) {
      // Check if files exisit
      if (!files || files.length === 0) {
        res.render('images', {
          files: false,
          isAuthenticated: true,
        });
      } else {
        files.map(function (file) {
          if (
            file.contentType === 'image/jpeg' ||
            file.contentType === 'image/png' ||
            file.contentType === 'image/gif'
          ) {
            file.isImage = true;
          } else {
            file.isImage = false;
          }
        });

        res.render('images', {
          files: files,
          isAuthenticated: true,
        });
      }
    });
  } else {
    // if notAuthenticated, can view only
    Upload.find({}, function (err, files) {
      // Check if files
      if (!files || files.length === 0) {
        res.render('images', {
          files: false,
          isAuthenticated: false,
        });
      } else {
        files.map(function (file) {
          if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
            file.isImage = true;
          } else {
            file.isImage = false;
          }
        });
        // files = files.map(({_doc:{_id, __v , ...file}}) => {return file;})
        // console.log(files);
        files = files.map((file) => {
          delete file._doc._id;
          delete file._doc.uploadDate;
          return file;
        });
        res.render('images', {
          files: files,
          isAuthenticated: false,
        });
      }
    });
  }
});

// 6. open a single image - general image opening
app.get('/images/:filename', function (req, res) {
  gfs.files.findOne(
    {
      filename: req.params.filename,
    },
    function (err, file) {
      if (!file || file.length === 0) {
        return res.status(404).json({
          err: 'No file exisits',
        });
      }
      if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === 'image/gif') {
        const readStream = gfs.createReadStream(file.filename);
        readStream.pipe(res);
      } else {
        res.status(404).json({
          err: 'No an image',
        });
      }
    },
  );
});

// 7. open image category
app.get('/images/category/:category', function (req, res) {
  if (req.isAuthenticated()) {
    Upload.find(
      {
        category: req.params.category,
      },
      function (err, files) {
        // Check if files exisit
        if (!files || files.length === 0) {
          res.render('images', {
            files: false,
            isAuthenticated: true,
          });
        } else {
          files.map(function (file) {
            if (
              file.contentType === 'image/jpeg' ||
              file.contentType === 'image/png' ||
              file.contentType === 'image/gif'
            ) {
              file.isImage = true;
            } else {
              file.isImage = false;
            }
          });
          res.render('images', {
            files: files,
            isAuthenticated: true,
          });
        }
      },
    );
  } else {
    // if notAuthenticated, can view only
    Upload.find(
      {
        category: req.params.category,
      },
      function (err, files) {
        // Check if files
        if (!files || files.length === 0) {
          res.render('images', {
            files: false,
            isAuthenticated: false,
          });
        } else {
          files.map(function (file) {
            if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
              file.isImage = true;
            } else {
              file.isImage = false;
            }
          });
          res.render('images', {
            files: files,
            isAuthenticated: false,
          });
        }
      },
    );
  }
});

// 8. delete a file in both upload file storage and upload file log (need Authorization)
app.delete('/files/:id', function (req, res) {
  if (req.isAuthenticated()) {
    gfs.remove(
      {
        _id: req.params.id,
        root: 'uploads',
      },
      function (err, gridStore) {
        if (err) {
          return res.status(404).json({
            err: err,
          });
        } else {
          Upload.deleteOne(
            {
              id: req.params.id,
            },
            function (err) {
              if (!err) {
                res.redirect('/upload');
              }
            },
          );
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

// 9. delete an image in both upload file storage and upload file log (need Authorization)
app.delete('/images/:filename', function (req, res) {
  if (req.isAuthenticated()) {
    gfs.remove(
      {
        filename: req.params.filename,
        root: 'uploads',
      },
      function (err, gridStore) {
        if (err) {
          return res.status(404).json({
            err: err,
          });
        } else {
          Upload.deleteOne(
            {
              filename: req.params.filename,
            },
            function (err) {
              if (!err) {
                res.redirect('/images');
              } else {
                res.send(err);
              }
            },
          );
        }
      },
    );
  } else {
    res.redirect('/login');
  }
});

//////////////////////////////////Error Handling///////////////////////////////

// Fix 404 not found eror routing mongodb images through express
app.get('/images/course-profiles/:filename', (req, res) => {
  const filename = req.params.filename;

  gfs.files.findOne({ filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({ err: 'No file exists' });
    }

    // check if it's an image
    if (
      file.contentType === 'image/jpeg' ||
      file.contentType === 'image/png' ||
      file.contentType === 'image/webp'
    ) {
      const readstream = gfs.createReadStream({ filename });
      readstream.pipe(res);
    } else {
      res.status(404).json({ err: 'Not an image' });
    }
  });
});


app.get('/404', function (req, res) {
  res.render('404');
});

// 404 error page not found
app.use(function (req, res, next) {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
});

// 404 and server error handler
app.use(function (error, req, res, next) {
  console.log(`Route not found: ${req.method} ${req.originalUrl}`);

  res.status(error.status || 500);
  res.redirect(`/404`);
  console.log(error);
});

///////////////////////////////Server Listening Check//////////////////////////
let port = process.env.PORT;
if (port == null || port == '') {
  port = 3000;
}
app.listen(port, function () {
  console.log('Server started successfully.');
});
