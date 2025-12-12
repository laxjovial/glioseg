# Glioma AI Workstation - Setup Instructions

## Prerequisites

1. **Python 3.8 or higher**
2. **MongoDB** - Install and run locally on default port (27017)
3. **Git** (for version control)

## Installation Steps

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Setup MongoDB

**Windows:**

- Download MongoDB Community Server
- Install and start MongoDB service
- Default connection: `mongodb://localhost:27017`

**Linux/Mac:**

- Install via package manager or download from MongoDB website
- Start MongoDB service

### 3. Email Configuration

1. Copy the example environment file:

```bash
copy .env.example .env
```

2. Edit `.env` file with your email settings:
   - For Gmail: Enable 2-factor authentication and create an App Password
   - Update `EMAIL_USER` and `EMAIL_PASSWORD`
   - For other providers, update `EMAIL_HOST` and `EMAIL_PORT`

### 4. Model File

Ensure `best_model_inference.pth` is in the `backend/` directory.

## Running the Application

### Start the Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Access the Application

Open your browser and navigate to:

```
http://localhost:8000
```

## Features Overview

### Patient Management

- ✅ Register new patients with complete metadata
- ✅ Search patients by ID, name, email, or medical record number
- ✅ View all patients with pagination
- ✅ Update patient information

### MRI Upload & Processing

- ✅ Individual file upload (T1c, T1n, T2f, T2w)
- ✅ ZIP file upload with automatic validation
- ✅ Support for .nii and .nii.gz formats
- ✅ Patient-specific file organization

### AI Segmentation

- ✅ Advanced brain tumor segmentation
- ✅ Tumor volume calculation
- ✅ Confidence scoring
- ✅ Radiologist notes integration
- ✅ Slice-by-slice visualization with overlay

### Results Management

- ✅ Interactive slice viewer with opacity control
- ✅ Results history for each patient
- ✅ Downloadable segmentation masks
- ✅ PDF report generation
- ✅ Email delivery with attachments

### Email Integration

- ✅ Automated result delivery
- ✅ Custom email messages
- ✅ PDF report attachments
- ✅ Segmentation mask attachments
- ✅ Professional HTML email templates

## API Endpoints

### Patient Management

- `POST /patients/register` - Register new patient
- `GET /patients/{patient_id}` - Get patient details
- `PUT /patients/{patient_id}` - Update patient
- `GET /patients` - List all patients
- `POST /patients/search` - Search patients
- `DELETE /patients/{patient_id}` - Delete patient

### File Upload

- `POST /upload/files/{patient_id}` - Upload individual files
- `POST /upload/zip/{patient_id}` - Upload ZIP file

### Segmentation

- `POST /segment/{patient_id}/{scan_id}` - Run segmentation

### Downloads & Export

- `GET /download/mask/{patient_id}/{scan_id}` - Download mask
- `GET /download/report/{patient_id}/{scan_id}` - Download PDF report
- `POST /email/{patient_id}/{scan_id}` - Send results via email

## Database Structure

### Patient Collection

```json
{
  "_id": "uuid",
  "patient_id": "string",
  "name": "string",
  "age": "number",
  "sex": "string",
  "email": "string",
  "phone": "string",
  "medical_record_number": "string",
  "date_of_birth": "string",
  "attending_physician": "string",
  "notes": "string",
  "created_timestamp": "datetime",
  "last_updated": "datetime",
  "scans": [
    {
      "scan_id": "uuid",
      "t1c": "string",
      "t1n": "string",
      "t2f": "string",
      "t2w": "string",
      "upload_timestamp": "datetime",
      "radiologist_notes": "string"
    }
  ],
  "segmentation_results": [
    {
      "scan_id": "string",
      "result_id": "uuid",
      "mask_path": "string",
      "mri_slice_paths": ["string"],
      "overlay_slice_paths": ["string"],
      "tumor_volume": "float",
      "confidence_score": "float",
      "processing_timestamp": "datetime",
      "radiologist_notes": "string"
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**

   - Ensure MongoDB is running
   - Check connection string in environment variables

2. **Email Sending Fails**

   - Verify email credentials in `.env` file
   - For Gmail, ensure App Password is used, not regular password
   - Check firewall/network settings

3. **File Upload Issues**

   - Ensure upload directories exist and have write permissions
   - Check file format (.nii or .nii.gz)
   - Verify ZIP file contains required modalities

4. **Model Loading Error**
   - Ensure `best_model_inference.pth` exists in backend directory
   - Check model file integrity

### Performance Optimization

1. **Large Datasets**

   - Consider implementing pagination for patient lists
   - Add database indexing for frequently queried fields

2. **Image Processing**
   - Implement caching for processed slices
   - Consider using background tasks for long-running segmentations

## Security Considerations

1. **Data Protection**

   - Implement proper access controls
   - Add authentication/authorization
   - Use HTTPS in production
   - Encrypt sensitive data

2. **File Upload Security**
   - Validate file types and sizes
   - Implement virus scanning
   - Use secure file storage

## Future Enhancements

- [ ] WhatsApp integration for results delivery
- [ ] Advanced analytics dashboard
- [ ] Integration with hospital information systems (HIS)
- [ ] Multi-user authentication and role management
- [ ] Audit logging and compliance features
- [ ] Real-time collaboration features
- [ ] Advanced visualization tools

## Support

For technical support or questions:

- Check the troubleshooting section above
- Review the API documentation
- Ensure all dependencies are properly installed
