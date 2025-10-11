const mongoose = require("mongoose");

const mongoURI = "mongodb+srv://jesus:lookfar@cluster0.paq40nb.mongodb.net/ssmDB";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const uploadSchema = {
    id: String,
    filename: String,
    category: String,
    description: String,
    contentType: String,
    uploadDate: Date,
};
const Upload = mongoose.model("Upload", uploadSchema);

Upload.deleteMany(
    {
        category: "",
    },
    function (err, files) {
        console.log(files);
    }
);
