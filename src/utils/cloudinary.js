import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
 

cloudinary.config({ 
    cloud_name: process.env.CLOUDNAME, 
    api_key: process.env.APIKEY, 
    api_secret: process.env.APISECRET
});

const uploadOnCloundinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            return null;
        }

        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type: "image",
        });

        console.log("file is uploaded on cloudinary", response);
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath);
        console.log("error while uploading file on cloudinary", error);
        return null
    }
}

export {uploadOnCloundinary}