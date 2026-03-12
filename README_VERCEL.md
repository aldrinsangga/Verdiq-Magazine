# Vercel Deployment Guide

This project is a full-stack Express + Vite application. To deploy it to Vercel, follow these steps:

## 1. Environment Variables
Set the following environment variables in your Vercel project settings:

- `GEMINI_API_KEY`: Your Google Gemini API key.
- `VITE_BACKEND_URL`: (Optional) Set this if you want to point to a specific backend URL, otherwise it defaults to the same origin.
- `NODE_ENV`: Set to `production`.

## 2. Firebase Configuration
The project uses `firebase-applet-config.json` for Firebase settings. This file is included in the repository. If you want to use a different Firebase project, update this file with your new project's credentials.

## 3. GitHub Deployment
1. Push your code to a GitHub repository.
2. Import the repository into Vercel.
3. Vercel should automatically detect the Vite project.
4. The `vercel.json` file handles routing for the Express API.

## 4. Custom Domain
After deployment, go to the "Settings" > "Domains" tab in Vercel to add your custom domain.

## 5. Firebase Admin SDK (Optional but Recommended)
For full functionality (like advanced Auth and Storage features), you should provide a Service Account key. You can set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable with the path to your service account JSON file, or use the `FIREBASE_SERVICE_ACCOUNT` environment variable with the JSON content.
