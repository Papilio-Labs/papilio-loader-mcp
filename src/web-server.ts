import express, { Request, Response } from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { loadFirmware } from "./papilio-loader.js";
import { SerialPort } from "serialport";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Web server for browser-based file uploads to Papilio boards
 */
export class PapilioWebServer {
  private app: express.Application;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Enable CORS
    this.app.use(cors());

    // Parse JSON bodies
    this.app.use(express.json());

    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, "../public")));

    // Configure file upload
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
      },
    });

    const upload = multer({
      storage,
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === ".bit" || ext === ".bin") {
          cb(null, true);
        } else {
          cb(new Error("Only .bit and .bin files are allowed"));
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
      },
    });

    this.app.locals.upload = upload;
  }

  private setupRoutes(): void {
    // Get available serial ports
    this.app.get("/api/ports", async (req: Request, res: Response) => {
      try {
        const ports = await SerialPort.list();
        res.json({
          success: true,
          ports: ports.map((p) => ({
            path: p.path,
            manufacturer: p.manufacturer || "Unknown",
            serialNumber: p.serialNumber,
            vendorId: p.vendorId,
            productId: p.productId,
          })),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Upload and flash FPGA bitfile
    this.app.post(
      "/api/upload/fpga",
      this.app.locals.upload.single("file"),
      async (req: Request, res: Response) => {
        try {
          if (!req.file) {
            return res.status(400).json({
              success: false,
              error: "No file uploaded",
            });
          }

          const { port } = req.body;
          if (!port) {
            return res.status(400).json({
              success: false,
              error: "Serial port not specified",
            });
          }

          const result = await loadFirmware(port, req.file.path, "fpga");

          res.json({
            success: true,
            message: `FPGA bitfile loaded successfully to ${port}`,
            details: result,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    // Upload and flash ESP32 firmware
    this.app.post(
      "/api/upload/esp32",
      this.app.locals.upload.single("file"),
      async (req: Request, res: Response) => {
        try {
          if (!req.file) {
            return res.status(400).json({
              success: false,
              error: "No file uploaded",
            });
          }

          const { port, address } = req.body;
          if (!port) {
            return res.status(400).json({
              success: false,
              error: "Serial port not specified",
            });
          }

          const result = await loadFirmware(
            port,
            req.file.path,
            "esp32",
            address || "0x1000"
          );

          res.json({
            success: true,
            message: `ESP32 firmware loaded successfully to ${port}`,
            details: result,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    // Health check
    this.app.get("/api/health", (req: Request, res: Response) => {
      res.json({ status: "ok", service: "papilio-loader-web" });
    });
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log(`Papilio Web Server running at http://localhost:${this.port}`);
      console.log(`Upload interface available at http://localhost:${this.port}/`);
    });
  }
}
