// import jwt from 'jsonwebtoken';

// export const verifyToken = (req, res, next) => {
//     const token = req.cookies.token; 

//     if (!token) {
//         return res.status(401).json({ message: "Unauthorized: No token provided" });
//     }

//     try {
//         const decoded = jwt.verify(token, process.env.JWTTOKEN);
//         req.user = decoded; // Attach user info to request object
//         next(); // Move to the next middleware/route handler
//     } catch (error) {
//         return res.status(403).json({ message: "Forbidden: Invalid token" });
//     }
// };
