/**
 * fixtureCorpus.js — a small, frozen corpus of André's publications.
 *
 * The live RAG index fetches papers from OpenAlex at runtime; that is not
 * deterministic and requires the network, so the retrieval eval runs against
 * this committed fixture instead. Each entry mirrors the shape the BM25 index
 * is fed: an id plus searchable text (title + abstract snippet).
 *
 * Keep ids stable — the retrieval dataset references them.
 */

/** @type {{ id: string, title: string, abstract: string }[]} */
export const FIXTURE_CORPUS = [
    {
        id: 'fastpathology',
        title: 'FastPathology: An Open-Source Platform for Deep Learning-Based Research and Decision Support in Digital Pathology',
        abstract:
            'A open-source and cross-platform software for deep learning inference and visualization of whole slide images in digital pathology. Built in C++ and Qt5, it enables real-time neural network deployment on gigapixel histopathology images with efficient tiling and rendering.',
    },
    {
        id: 'h2g-net',
        title: 'H2G-Net: A Multi-Resolution Refinement Approach for Segmentation of Breast Cancer Region in Gigapixel Histopathological Images',
        abstract:
            'A hierarchical cascaded convolutional neural network for semantic segmentation of tumour tissue in breast cancer whole slide images. Combines a low-resolution detection stage with a high-resolution refinement stage to segment gigapixel pathology images accurately.',
    },
    {
        id: 'raidionics',
        title: 'Raidionics: An Open Software for Pre- and Postoperative Central Nervous System Tumor Segmentation and Standardized Reporting',
        abstract:
            'Clinical software for automatic brain tumour segmentation from MRI and standardized clinical reporting. Supports gliomas, meningiomas and metastases with deep learning models and generates reproducible radiological reports for neuro-oncology.',
    },
    {
        id: 'gradient-accumulator',
        title: 'Gradient Accumulator: Enabling Large Batch Training under Limited GPU Memory in TensorFlow 2',
        abstract:
            'A Python package that adds gradient accumulation to TensorFlow 2 and Keras, allowing training with effective large batch sizes on GPUs with limited memory by accumulating gradients over multiple mini-batches before an optimizer step.',
    },
    {
        id: 'torchstain',
        title: 'Torchstain: Reproducible Stain Normalization for Computational Histopathology',
        abstract:
            'A framework-agnostic library implementing Macenko and Reinhard stain normalization for histopathology images, with backends for PyTorch, TensorFlow and NumPy to standardize colour appearance across whole slide images.',
    },
    {
        id: 'livermask',
        title: 'Livermask: Automatic Liver Parenchyma and Vessel Segmentation from CT using Deep Learning',
        abstract:
            'A command line tool and Python package for fully automatic segmentation of the liver parenchyma and hepatic vessels from abdominal CT volumes using a pretrained deep convolutional neural network.',
    },
    {
        id: 'semi-supervised-wsi',
        title: 'Semi-Supervised Learning for Tissue Classification in Whole Slide Images with Limited Annotations',
        abstract:
            'Investigates semi-supervised deep learning to reduce annotation cost for tissue-type classification in digital pathology, using unlabeled whole slide images together with a small set of expert annotations to improve model generalisation.',
    },
    {
        id: 'clinical-nlp-summary',
        title: 'Speech-to-Clinical-Summary: Norwegian NLP for Generating Structured Notes from Patient Conversations',
        abstract:
            'A natural language processing pipeline that transcribes Norwegian patient-clinician conversations and generates structured clinical summaries, combining speech recognition with large language models for hospital documentation.',
    },
];
