import express from 'express';
import cors from 'cors';
import router from './routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", router);

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server running on port ${port}`));