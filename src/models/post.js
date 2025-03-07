import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    discription: {
        type: String,
        required: true
    },
    image: {
        type: String,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    date: {
        type:String,
        required: true
    },
    imageID: {
        type: String,
        required: true
    },
    comments: [
        {
            commentID: String,
            comment: String,
            date: String,
            username: String,
            name: String,
        }
    ]
})  

export const Post = mongoose.models.Post || mongoose.model('Post', postSchema);