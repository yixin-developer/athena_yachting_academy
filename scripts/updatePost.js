const mongoose = require("mongoose");

// const mongoURI = "mongodb+srv://jesus:lookfar@cluster0.paq40nb.mongodb.net/ssmDB";
const mongoURI = "mongodb+srv://admin_yixin:" + ".s0g72nkw" + "@cluster0-jmiqr.mongodb.net/ssmDB";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const postSchema = {
    title: String,
    subtitle: String,
    date: Date,
    author: String,
    category: String,
    content: String,
    image: Array,
};
const Post = mongoose.model("Post", postSchema);
(async () => {
    const posts = await Post.find({});

    posts.map(post => post.update({ image: post.image}, { new: true}).exec());
    console.log(posts);
})();
