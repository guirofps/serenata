# DEVOLVE A TEXTURA FINA DO ORIGINAL AO ROSTO TROCADO (16/10).
#
# O FaceFusion acerta a identidade, mas o rosto sai com ~metade da nitidez do
# original (Laplaciano medido 20 contra 40 no Vid 5): poros, fio da barba e o
# granulado do iPhone somem, e isso aparece como "blur" no vídeo todo.
#
# A identidade mora nas frequências baixas e médias (formato de olho, nariz,
# boca, sombra). A textura mora nas altas. Então, quadro a quadro:
#   saída = trocado + força * máscara * (original - blur(original, sigma))
# Só a faixa fina do original volta, e só onde o rosto foi trocado (a máscara
# sai da diferença entre os dois vídeos, suavizada). Olhos e boca levam força
# menor, pra a borda deles não fantasmagorizar o rosto antigo.
#
#   python scratch/faceswap/textura.py <original.mp4> <trocado.mp4> <saida.mp4> [força=0.8] [sigma=1.6]
import subprocess, sys
import cv2
import numpy as np

orig_p, troc_p, saida_p = sys.argv[1:4]
forca = float(sys.argv[4]) if len(sys.argv) > 4 else 0.8
sigma = float(sys.argv[5]) if len(sys.argv) > 5 else 1.6

a = cv2.VideoCapture(orig_p)
b = cv2.VideoCapture(troc_p)
fps = b.get(cv2.CAP_PROP_FPS)
w = int(b.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(b.get(cv2.CAP_PROP_FRAME_HEIGHT))

enc = subprocess.Popen(
    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
     "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
     "-i", troc_p, "-map", "0:v", "-map", "1:a?",
     "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "copy", saida_p],
    stdin=subprocess.PIPE,
)

mascara_ant = None
desvio_ant = None
n = 0
while True:
    ok1, fa = a.read()
    ok2, fb = b.read()
    if not (ok1 and ok2):
        break
    if fa.shape != fb.shape:
        fa = cv2.resize(fa, (fb.shape[1], fb.shape[0]))
    A = fa.astype(np.float32)
    B = fb.astype(np.float32)

    # Onde o rosto foi trocado: diferença grossa entre os dois, sem ruído fino.
    dif = cv2.GaussianBlur(np.abs(A - B).mean(axis=2), (0, 0), 6)
    m = np.clip((dif - 4.0) / 10.0, 0, 1)
    m = cv2.dilate(m, np.ones((25, 25), np.uint8))
    m = cv2.GaussianBlur(m, (0, 0), 15)
    # Suaviza a máscara no tempo: sem isso ela pisca de um quadro pro outro.
    if mascara_ant is not None:
        m = 0.6 * m + 0.4 * mascara_ant
    mascara_ant = m

    # Olhos e boca: onde a diferença é ALTA é traço do rosto (borda de olho,
    # lábio), não pele. Ali a textura entra mais fraca.
    traco = np.clip((dif - 25.0) / 25.0, 0, 1)
    peso = (m * (1.0 - 0.7 * traco))[..., None]

    # A COR DA PELE DO ORIGINAL. O realce do FaceFusion deixa o rosto mais
    # rosado que o pescoço e as orelhas, e é isso que dá cara de "colado".
    # Puxa a média de cor (a, b do LAB) do rosto trocado pra média do original
    # na mesma região, e só um pouco do brilho (L). Média suavizada no tempo.
    dentro = m > 0.5
    if dentro.sum() > 500:
        la = cv2.cvtColor(fa, cv2.COLOR_BGR2LAB).astype(np.float32)
        lb = cv2.cvtColor(fb, cv2.COLOR_BGR2LAB).astype(np.float32)
        desvio = la[dentro].mean(axis=0) - lb[dentro].mean(axis=0)
        desvio_ant = desvio if desvio_ant is None else 0.8 * desvio_ant + 0.2 * desvio
        corr = desvio_ant * np.array([0.3, 0.8, 0.8], np.float32)
        lb += m[..., None] * corr
        B = cv2.cvtColor(np.clip(lb, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    alta = A - cv2.GaussianBlur(A, (0, 0), sigma)
    C = np.clip(B + forca * peso * alta, 0, 255).astype(np.uint8)
    enc.stdin.write(C.tobytes())
    n += 1

enc.stdin.close()
enc.wait()
print(f"{n} quadros -> {saida_p}")
