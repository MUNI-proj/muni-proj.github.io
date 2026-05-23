import { muniTextAssets } from "./muni-text-assets";

export type MediaKind = "audio" | "image" | "text" | "empty";

export interface MediaItem {
  label: string;
  kind: MediaKind;
  src?: string;
  waveformSrc?: string;
  waveformAlt?: string;
  text?: string;
  alt?: string;
}

export interface MediaGroup {
  label: string;
  items: MediaItem[];
}

export interface QualitativeSample {
  title: string;
  subtitle?: string;
  note?: string;
  sources?: MediaItem[];
  outputs?: MediaItem[];
  groups?: MediaGroup[];
}

const qPublic = "/muni/qualitative/qualitative_ita";
const qFigure = "figures/muni/qualitative/qualitative_ita";
const supplementary = "/muni/supplementary";
const rows = [0, 1, 2, 3, 4, 5] as const;

const qImg = (dir: string, file: string) => `${qPublic}/${dir}/${file}`;
const qPdf = (dir: string, file: string) => `${qFigure}/${dir}/${file}`;
const supp = (file: string) => `${supplementary}/${file}`;
const waveform = (src: string) =>
  src.startsWith(supplementary) && src.endsWith(".wav")
    ? src.replace(supplementary, "/muni/waveforms").replace(/\.wav$/, ".png")
    : undefined;

const imageItem = (label: string, src: string, alt: string): MediaItem => ({
  label,
  kind: "image",
  src,
  alt,
});

const textFromPdf = (src: string) => {
  const text =
    src in muniTextAssets
      ? muniTextAssets[src as keyof typeof muniTextAssets]
      : undefined;

  if (!text) {
    throw new Error(`Missing qualitative text asset for ${src}`);
  }

  return text;
};

const textPdfItem = (label: string, src: string, alt: string): MediaItem => ({
  label,
  kind: "text",
  text: textFromPdf(src),
  alt,
});

const audioItem = (
  label: string,
  src: string,
  legacyWaveformSrc?: string,
  waveformAlt?: string,
): MediaItem => ({
  label,
  kind: "audio",
  src,
  waveformSrc: waveform(src),
  waveformAlt:
    waveformAlt ??
    (legacyWaveformSrc && !legacyWaveformSrc.endsWith(".pdf")
      ? legacyWaveformSrc
      : `${label} waveform`),
});

const textItem = (label: string, text: string): MediaItem => ({
  label,
  kind: "text",
  text,
});

const imageGenerationOutputs = (
  dir: string,
  id: number,
  oursFile = `Ours_${id}.png`,
): MediaItem[] => [
  imageItem("CoDi", qImg(dir, `CoDi_${id}.png`), "CoDi generated image"),
  imageItem(
    "OmniFlow",
    qImg(dir, `OmniFlow_${id}.png`),
    "OmniFlow generated image",
  ),
  imageItem(
    "FlowBind",
    qImg(dir, `FlowBind_${id}.png`),
    "FlowBind generated image",
  ),
  imageItem("MUNI", qImg(dir, oursFile), "MUNI generated image"),
];

const textGenerationOutputs = (
  dir: string,
  id: string,
  oursFile = `${id}_ours_hell_200_text.pdf`,
): MediaItem[] => [
  textPdfItem("CoDi", qPdf(dir, `${id}_codi_text.pdf`), "CoDi generated text"),
  textPdfItem(
    "OmniFlow",
    qPdf(dir, `${id}_omniflow_text.pdf`),
    "OmniFlow generated text",
  ),
  textPdfItem(
    "FlowBind",
    qPdf(dir, `${id}_flowbind_text.pdf`),
    "FlowBind generated text",
  ),
  textPdfItem("MUNI", qPdf(dir, oursFile), "MUNI generated text"),
];

const audioGenerationOutputs = (dir: string, id: number): MediaItem[] => [
  audioItem("CoDi", supp(`${dir}/${id}/codi_${id}.wav`)),
  audioItem("OmniFlow", supp(`${dir}/${id}/omniflow_${id}.wav`)),
  audioItem("FlowBind", supp(`${dir}/${id}/flowbind_${id}.wav`)),
  audioItem("MUNI", supp(`${dir}/${id}/ours_${id}.wav`)),
];

const mainUnconditionalRows = [
  ["ours_hell_200_078", "Figure3/row0_col0.wav"],
  ["ours_poe_200_255", "Figure3/row0_col1.wav"],
  ["ours_hell_200_145", "Figure3/row1_col0.wav"],
  ["ours_poe_200_050", "Figure3/row1_col1.wav"],
] as const;

export const mainUnconditionalSamples: QualitativeSample[] =
  mainUnconditionalRows.map(([id, audioSrc], index) => ({
    title: `Unconditional sample ${index + 1}`,
    subtitle: "Prior → Text+Audio+Image",
    outputs: [
      textPdfItem(
        "Generated text",
        qPdf("uncond_ours", `${id}_caption_text.pdf`),
        "MUNI unconditional generated text",
      ),
      audioItem(
        "Generated audio",
        supp(audioSrc),
        qPdf("uncond_ours", `${id}_audio.pdf`),
        "MUNI unconditional generated waveform",
      ),
      imageItem(
        "Generated image",
        qImg("uncond_ours", `${id}.png`),
        "MUNI unconditional generated image",
      ),
    ],
  }));

export const textToImageSamples: QualitativeSample[] = rows.map((id) => ({
  title: `Text → Image ${id + 1}`,
  subtitle: "T → I",
  sources: [
    textPdfItem(
      "Source text",
      qPdf("T_to_I", `${id}_src_text.pdf`),
      "Source text prompt",
    ),
  ],
  outputs: imageGenerationOutputs("T_to_I", id),
}));

const imageToTextIds = ["014", "039", "065", "069", "077", "080"];

export const imageToTextSamples: QualitativeSample[] = imageToTextIds.map(
  (id, index) => ({
    title: `Image → Text ${index + 1}`,
    subtitle: "I → T",
    sources: [
      imageItem("Source image", qImg("I_to_T", `${id}_src.png`), "Source image"),
    ],
    outputs: textGenerationOutputs("I_to_T", id),
  }),
);

const audioToTextIds = ["012", "024", "046", "058", "073", "118"];

export const audioToTextSamples: QualitativeSample[] = audioToTextIds.map(
  (id, index) => ({
  title: `Audio → Text ${index + 1}`,
  subtitle: "A → T",
  sources: [
      audioItem(
        "Source audio",
        supp(`Figure6/row_${index}.wav`),
        qPdf("A_to_T", `${id}_src_audio.pdf`),
        "Source audio waveform",
      ),
    ],
    outputs: textGenerationOutputs("A_to_T", id),
  }),
);

const audioToImageIds = ["041", "058", "091", "124", "228", "284"];
const audioToImageOurs = [
  "041_ours_hell_200.png",
  "058_ours_poe_200.png",
  "091_ours_poe_200.png",
  "124_ours_hell_200.png",
  "228_ours_hell_200.png",
  "284_ours_hell_200.png",
] as const;

export const audioToImageSamples: QualitativeSample[] = audioToImageIds.map(
  (id, index) => ({
  title: `Audio → Image ${index + 1}`,
  subtitle: "A → I",
  sources: [
      audioItem(
        "Source audio",
        supp(`Figure7/row_${index}.wav`),
        qPdf("A_to_I", `${id}_src_audio.pdf`),
        "Source audio waveform",
      ),
    ],
    outputs: [
      imageItem("CoDi", qImg("A_to_I", `${id}_codi.png`), "CoDi generated image"),
      imageItem(
        "OmniFlow",
        qImg("A_to_I", `${id}_omniflow.png`),
        "OmniFlow generated image",
      ),
      imageItem(
        "FlowBind",
        qImg("A_to_I", `${id}_flowbind.png`),
        "FlowBind generated image",
      ),
      imageItem(
        "MUNI",
        qImg("A_to_I", audioToImageOurs[index]),
        "MUNI generated image",
      ),
    ],
  }),
);

const imageAudioToTextIds = ["013", "0", "256", "366", "1", "203"];

export const imageAudioToTextSamples: QualitativeSample[] =
  imageAudioToTextIds.map((id, index) => ({
    title: `Image+Audio → Text ${index + 1}`,
    subtitle: "I+A → T",
    sources: [
      imageItem(
        "Source image",
        qImg("IandA_to_T", `${id}_src.png`),
        "Source image",
      ),
      audioItem(
        "Source audio",
        supp(`Figure8/row_${index}.wav`),
        qPdf("IandA_to_T", `${id}_src_audio.pdf`),
        "Source audio waveform",
      ),
    ],
    outputs: textGenerationOutputs("IandA_to_T", id),
  }));

export const textAudioToImageSamples: QualitativeSample[] = rows.map((id) => ({
  title: `Text+Audio → Image ${id + 1}`,
  subtitle: "T+A → I",
  sources: [
    textPdfItem(
      "Source text",
      qPdf("TandA_to_I", `${id}_src_text.pdf`),
      "Source text prompt",
    ),
    audioItem(
      "Source audio",
      supp(`Figure9/row_${id}.wav`),
      qPdf("TandA_to_I", `${id}_audio.pdf`),
      "Source audio waveform",
    ),
  ],
  outputs: imageGenerationOutputs("TandA_to_I", id),
}));

const uncondGeneralistRows = [
  ["483", "Figure10/omniflow_col0.wav", "Figure10/ours_col0.wav"],
  ["484", "Figure10/omniflow_col1.wav", "Figure10/ours_col1.wav"],
] as const;

export const uncondGeneralistSamples: QualitativeSample[] =
  uncondGeneralistRows.map(([id, omniAudio, muniAudio], index) => ({
    title: `Unconditional generalist comparison ${index + 1}`,
    subtitle: "Prior → Text+Audio+Image",
    groups: [
      {
        label: "OmniFlow",
        items: [
          textPdfItem(
            "Text",
            qPdf("uncond/generalists", `${id}_omniflow_caption_text.pdf`),
            "OmniFlow unconditional text",
          ),
          audioItem(
            "Audio",
            supp(omniAudio),
            qPdf("uncond/generalists", `${id}_omniflow_audio.pdf`),
            "OmniFlow unconditional waveform",
          ),
          imageItem(
            "Image",
            qImg("uncond/generalists", `${id}_omniflow.png`),
            "OmniFlow unconditional image",
          ),
        ],
      },
      {
        label: "MUNI",
        items: [
          textPdfItem(
            "Text",
            qPdf("uncond/generalists", `${id}_ours_hell_200_caption_text.pdf`),
            "MUNI unconditional text",
          ),
          audioItem(
            "Audio",
            supp(muniAudio),
            qPdf("uncond/generalists", `${id}_ours_hell_200_audio.pdf`),
            "MUNI unconditional waveform",
          ),
          imageItem(
            "Image",
            qImg("uncond/generalists", `${id}_ours_hell_200.png`),
            "MUNI unconditional image",
          ),
        ],
      },
    ],
    note: "CoDi and FlowBind are omitted because this comparison is fully unconditional.",
  }));

const uncondVaeRows = [
  [
    "451",
    "Figure11/mmvae_col0.wav",
    "Figure11/mopoe_col0.wav",
    "Figure11/ours_col0.wav",
  ],
  [
    "241",
    "Figure11/mmvae_col1.wav",
    "Figure11/mopoe_col1.wav",
    "Figure11/ours_col1.wav",
  ],
] as const;

export const uncondVaeSamples: QualitativeSample[] = uncondVaeRows.map(
  ([id, mmvaeAudio, mopoeAudio, muniAudio], index) => ({
    title: `Unconditional VAE comparison ${index + 1}`,
    subtitle: "Prior → Text+Audio+Image",
    groups: [
      {
        label: "MMVAE",
        items: [
          textPdfItem(
            "Text",
            qPdf("uncond/mvaes", `${id}_moe_200_caption_text.pdf`),
            "MMVAE unconditional text",
          ),
          audioItem(
            "Audio",
            supp(mmvaeAudio),
            qPdf("uncond/mvaes", `${id}_moe_200_audio.pdf`),
            "MMVAE unconditional waveform",
          ),
          imageItem(
            "Image",
            qImg("uncond/mvaes", `${id}_moe_200.png`),
            "MMVAE unconditional image",
          ),
        ],
      },
      {
        label: "MoPoE",
        items: [
          textPdfItem(
            "Text",
            qPdf("uncond/mvaes", `${id}_mopoe_200_caption_text.pdf`),
            "MoPoE unconditional text",
          ),
          audioItem(
            "Audio",
            supp(mopoeAudio),
            qPdf("uncond/mvaes", `${id}_mopoe_200_audio.pdf`),
            "MoPoE unconditional waveform",
          ),
          imageItem(
            "Image",
            qImg("uncond/mvaes", `${id}_mopoe_200.png`),
            "MoPoE unconditional image",
          ),
        ],
      },
      {
        label: "MUNI",
        items: [
          textPdfItem(
            "Text",
            qPdf("uncond/mvaes", `${id}_ours_hell_200_caption_text.pdf`),
            "MUNI unconditional text",
          ),
          audioItem(
            "Audio",
            supp(muniAudio),
            qPdf("uncond/mvaes", `${id}_ours_hell_200_audio.pdf`),
            "MUNI unconditional waveform",
          ),
          imageItem(
            "Image",
            qImg("uncond/mvaes", `${id}_ours_hell_200.png`),
            "MUNI unconditional image",
          ),
        ],
      },
    ],
  }),
);

const textToAudioPrompts = [
  "pigeons coo and flap their wings",
  "a telephone ringing",
  "water makes gurgling sound",
  "a person speaking and various laughter and clapping",
  "A clock ticks repeatedly",
  "a male speaking over a microphone",
] as const;

export const textToAudioSamples: QualitativeSample[] = rows.map((id) => ({
  title: `Text → Audio ${id + 1}`,
  subtitle: "T → A",
  sources: [textItem("Source text", textToAudioPrompts[id])],
  outputs: audioGenerationOutputs("T_to_A", id),
}));

export const imageToAudioSamples: QualitativeSample[] = rows.map((id) => ({
  title: `Image → Audio ${id + 1}`,
  subtitle: "I → A",
  sources: [
    imageItem(
      "Source image",
      supp(`I_to_A/${id}/src_image_${id}.png`),
      "Source image",
    ),
  ],
  outputs: audioGenerationOutputs("I_to_A", id),
}));

const textImageToAudioPrompts = [
  "A man playing acoustic guitar on a wooden stage.",
  "It's a rainy day.",
  "Someone is typing.",
  "A crowd is cheering.",
  "A machine is running.",
  "An engine is running.",
] as const;

export const textImageToAudioSamples: QualitativeSample[] = rows.map((id) => ({
  title: `Text+Image → Audio ${id + 1}`,
  subtitle: "T+I → A",
  sources: [
    textItem("Source text", textImageToAudioPrompts[id]),
    imageItem(
      "Source image",
      supp(`TI_to_A/${id}/src_image_${id}.png`),
      "Source image",
    ),
  ],
  outputs: audioGenerationOutputs("TI_to_A", id),
}));
