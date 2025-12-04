# Glioseg Backend

This is the backend for the Glioseg application, built with FastAPI and MongoDB.

## How to Run

1.  **Install dependencies:**
    ```bash
    pip install -r ../requirements.txt
    ```

2.  **Start the MongoDB server.**
    Make sure you have a MongoDB instance running on `mongodb://localhost:27017`.

3.  **Start the FastAPI server:**
    From this directory (`V1/backend`), run the following command:
    ```bash
    uvicorn main:app --host 0.0.0.0 --port 8000
    ```

4.  **Open your browser** and navigate to `http://localhost:8000`.
