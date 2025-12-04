import streamlit as st
import torch
import torchio as tio
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import tempfile
import os
from monai.networks.nets import UNet
from monai.inferers import sliding_window_inference

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
model = UNet(
    spatial_dims=3,
    in_channels=4,
    out_channels=4,
    channels=(16, 32, 64, 128, 256),
    strides=(2, 2, 2, 2),
    num_res_units=2,
    norm="batch"
)


# LOAD CHECKPOINT SAFELY ON CPU
@st.cache_resource
def load_model():
    ckpt_path = "best_model_inference.pth"

    checkpoint = torch.load(ckpt_path, map_location="cpu")

    model.load_state_dict(checkpoint)
    model.to("cpu")
    model.eval()
    return model


model = load_model()

# PREPROCESSING PIPELINE
preprocess = tio.Compose([
    tio.ToCanonical(),
    tio.Resample((1, 1, 1)),
    tio.CropOrPad((128, 128, 128)),
    tio.ZNormalization(),
])


# SAVE UPLOADED FILES TO TEMP DIRECTORY
def save_uploaded_file(uploaded_file, name):
    suffix = ".nii.gz" if uploaded_file.name.endswith(".gz") else ".nii"
    temp_path = os.path.join(tempfile.gettempdir(), name + suffix)

    with open(temp_path, "wb") as f:
        f.write(uploaded_file.read())

    return temp_path


# INFERENCE FUNCTION
def run_inference(files_dict, slice_idx=64):

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

    with torch.no_grad():
        output = sliding_window_inference(
            inputs, roi_size=(128, 128, 128), sw_batch_size=1, predictor=model
        )

        pred = torch.argmax(output, dim=1).cpu().squeeze(0).numpy()

    return subject, pred


# VISUALIZATION
def plot_results(subject, pred, slice_idx):

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    img = subject["t1c"][tio.DATA].squeeze(0).numpy()

    axes[0].imshow(img[:, :, slice_idx], cmap="gray")
    axes[0].set_title("T1C Input Slice")
    axes[0].axis("off")

    axes[1].imshow(pred[:, :, slice_idx], cmap=cmap, norm=norm)
    axes[1].set_title("Prediction")
    axes[1].axis("off")

    overlay = np.zeros((*pred[:, :, slice_idx].shape, 4))
    for lbl, col in label_colours.items():
        mask = pred[:, :, slice_idx] == lbl
        overlay[mask] = col

    axes[2].imshow(img[:, :, slice_idx], cmap="gray")
    axes[2].imshow(overlay)
    axes[2].set_title("Overlay")
    axes[2].axis("off")

    st.pyplot(fig)


# STREAMLIT UI
st.title("GlioSeg")

st.write("""
Upload the 4 MRI modalities (NIfTI format).  
The system preprocesses the scans, runs a trained 3D MONAI UNet, and returns voxel-wise tumor segmentation.

**Classes:**
- **Green** : NCR  
- **Red** : Edema  
- **Blue** : Enhancing Tumor  
""")

uploaded = {}
for mod in modalities:
    uploaded[mod] = st.file_uploader(f"Upload {mod}.nii or {mod}.nii.gz", type=["nii", "gz"])

if all(uploaded.values()):
    if st.button("Run Segmentation"):
        st.info("Saving files and running model...")

        # Save temp files
        files_dict = {}
        for m in modalities:
            files_dict[m] = save_uploaded_file(uploaded[m], m)

        subject, pred = run_inference(files_dict)

        st.success("Prediction complete!")
        slice_idx = st.slider("Slice index", 0, 127, 64)

        plot_results(subject, pred, slice_idx)

else:
    st.warning("Please upload all 4 MRI files to continue.")
