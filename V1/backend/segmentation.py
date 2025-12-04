import torch
import torchio as tio
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from monai.networks.nets import UNet
from monai.inferers import sliding_window_inference
import os

# CONFIG
modalities = ["t1c", "t1n", "t2f", "t2w"]

label_colours = {
    0: (0, 0, 0, 0),     # background transparent
    1: (0, 1, 0, 0.5),   # green - NCR
    2: (1, 0, 0, 0.5),   # red - ED
    3: (0, 0, 1, 0.5),   # blue - ET
}

cmap = mcolors.ListedColormap([label_colours[i] for i in range(len(label_colours))])
norm = mcolors.BoundaryNorm([-0.5, 0.5, 1.5, 2.5, 3.5], ncolors=4)

# MODEL SETUP
def get_model():
    model = UNet(
        spatial_dims=3,
        in_channels=4,
        out_channels=4,
        channels=(16, 32, 64, 128, 256),
        strides=(2, 2, 2, 2),
        num_res_units=2,
        norm="batch"
    )
    return model

def load_model(model):
    ckpt_path = "best_model_inference.pth"
    try:
        checkpoint = torch.load(ckpt_path, map_location="cpu")
        model.load_state_dict(checkpoint)
        model.to("cpu")
        model.eval()
        return model
    except FileNotFoundError:
        raise

# PREPROCESSING PIPELINE
preprocess = tio.Compose([
    tio.ToCanonical(),
    tio.Resample((1, 1, 1)),
    tio.CropOrPad((128, 128, 128)),
    tio.ZNormalization(),
])

# INFERENCE FUNCTION
def run_inference(files_dict):
    subject = tio.Subject(
        t1c=tio.ScalarImage(files_dict["t1c"]),
        t1n=tio.ScalarImage(files_dict["t1n"]),
        t2f=tio.ScalarImage(files_dict["t2f"]),
        t2w=tio.ScalarImage(files_dict["t2w"]),
    )

    subject = preprocess(subject)

    inputs = torch.cat(
        [subject[m][tio.DATA] for m in modalities], dim=0
    ).unsqueeze(0)

    model = get_model()
    model = load_model(model)

    with torch.no_grad():
        output = sliding_window_inference(
            inputs, roi_size=(128, 128, 128), sw_batch_size=1, predictor=model
        )
        pred = torch.argmax(output, dim=1).cpu().squeeze(0).numpy()

    return subject, pred


def save_slice_images(subject, pred, patient_id, scan_id, output_dir="static/outputs"):
    patient_dir = os.path.join(output_dir, patient_id, scan_id)
    os.makedirs(patient_dir, exist_ok=True)

    img = subject["t1c"][tio.DATA].squeeze(0).numpy()

    num_slices = img.shape[2]
    mri_slice_paths = []
    overlay_slice_paths = []

    for i in range(num_slices):
        # Save original MRI slice
        plt.figure(figsize=(5, 5))
        plt.imshow(img[:, :, i], cmap="gray")
        plt.axis("off")
        mri_slice_path = os.path.join(patient_dir, f"slice_{i}.png")
        plt.savefig(mri_slice_path, bbox_inches='tight', pad_inches=0)
        plt.close()
        mri_slice_paths.append(mri_slice_path)

        # Save overlay slice
        overlay = np.zeros((*pred[:, :, i].shape, 4))
        for lbl, col in label_colours.items():
            mask = pred[:, :, i] == lbl
            overlay[mask] = col

        plt.figure(figsize=(5, 5))
        plt.imshow(img[:, :, i], cmap="gray")
        plt.imshow(overlay)
        plt.axis("off")
        overlay_slice_path = os.path.join(patient_dir, f"slice_{i}_overlay.png")
        plt.savefig(overlay_slice_path, bbox_inches='tight', pad_inches=0)
        plt.close()
        overlay_slice_paths.append(overlay_slice_path)

    return mri_slice_paths, overlay_slice_paths

def save_segmentation_mask(pred, patient_id, scan_id, output_dir="uploads"):
    patient_dir = os.path.join(output_dir, patient_id)
    os.makedirs(patient_dir, exist_ok=True)
    mask_path = os.path.join(patient_dir, f"{scan_id}_mask.nii.gz")

    # Create a TorchIO image to save the prediction
    affine = np.eye(4)
    mask_image = tio.ScalarImage(tensor=torch.from_numpy(pred).unsqueeze(0), affine=affine)
    mask_image.save(mask_path)

    return mask_path
