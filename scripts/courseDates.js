const mongoose = require("mongoose");

const mongoURI = "mongodb+srv://jesus:lookfar@cluster0.paq40nb.mongodb.net/ssmDB";
// const mongoURI = "mongodb+srv://admin_yixin:" + ".s0g72nkw" + "@cluster0-jmiqr.mongodb.net/ssmDB";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
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
const CourseDate = mongoose.model("CourseDate", courseDateSchema);
(async () => {
    const details = {
        courseItem: {
            title: "RYA Start Yachting",
            date: "Sat Nov 19 2022",
            preferedDate: "",
            price: "375",
            quantity: "1",
        },
    };
    // inventory update start - look for the course sold
    console.log("hello1", details.courseItem);
    if (details.courseItem.title != "") {
        console.log("hello3", details.courseItem);
        var purchasedCourseTitle = details.courseItem.title;
        if (details.courseItem.date.substring(0, 6) != "Prefer") {
            console.log("hello2", details.courseItem.date);
            //if not - convert unixtime to ISOtime (mongoDB date format)
            var purchasedCourseDate = new Date(
                Date.parse(details.courseItem.date) + 120 * 60 * 1000
            ).toISOString().split("T")[0];
        } else {
            // if its a prefered date course end the function
            var purchasedCourseDate = details.courseItem.preferedDate;

            console.log(details.courseItem);
            var purchasedCourseQuantity = details.courseItem.quantity;
            //   //console.log("This course date is given by the client");
            //   //console.log("course purchased", purchasedCourseTitle, "course date", purchasedCourseDate, "number of students", purchasedCourseQuantity)
            return;
        }
        console.log(purchasedCourseDate, "purchasedCourseDate");
        var purchasedCourseQuantity = details.courseItem.quantity;
        // log purchased course info
        // //console.log("course purchased", purchasedCourseTitle, "course date", purchasedCourseDate, "number of students", purchasedCourseQuantity)

        //find the courses of same boat and date in datebase and update
        if (
            purchasedCourseTitle === "RYA Start Yachting" ||
            purchasedCourseTitle === "RYA Competent Crew" ||
            purchasedCourseTitle === "RYA Day Skipper Practical" ||
            purchasedCourseTitle === "RYA Coastal Skipper Practical"
        ) {
            var vessel = "Look Far - Bavaria 44 - Four cabin version";
        } else if (
            purchasedCourseTitle === "Transport Malta Nautical License" ||
            purchasedCourseTitle === "RYA Level 1 Powerboating" ||
            purchasedCourseTitle === "RYA Level 2 Powerboat Handling"
        ) {
            var vessel = "Powerboat";
        } else if (
            purchasedCourseTitle === "RYA Start Motor Cruising" ||
            purchasedCourseTitle === "RYA Motor Cruising Helmsman" ||
            purchasedCourseTitle === "RYA Motor Cruising Day Skipper" ||
            purchasedCourseTitle === "RYA Motor Cruising Coastal Skipper" ||
            purchasedCourseTitle === "RYA Motor Cruising Advanced Pilotage"
        ) {
            var vessel = "Motor Cruiser";
        } else {
            var vessel = "Shorebased";
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
                        date:purchasedCourseDate,
                    },
                ],
            },
            function (err, coursesFound) {
                console.log(coursesFound, vessel, "courses");
                if (!err) {
                    // //console.log("courses that share same vessel at same time", coursesFound);
                    //check and recalculate the inventory
                    coursesFound.forEach(function (courseFound, index) {
                        var courseId = courseFound._id;
                        var courseTitle = courseFound.title;
                        var previousAvailable = courseFound.available;
                        console.log(previousAvailable, "previousAvailable");
                        console.log(purchasedCourseQuantity, "purchasedCourseQuantity");
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
                            async function (err) {}
                        );
                    });
                }
            }
        );
    }
})();
