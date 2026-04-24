"""
Convierte todas las imágenes JPG/JPEG/PNG del directorio a WebP y borra los originales.
- Calidad inicial: 85
- Si el resultado supera 100 KB, reintenta con calidad 72 y luego 60
- Los archivos .webp existentes se omiten
"""
import os
from pathlib import Path
from PIL import Image

DIRECTORIO = Path(__file__).parent
EXTENSIONES = {".jpg", ".jpeg", ".png"}
LIMITE_KB = 100_000  # 100 KB en bytes
CALIDADES = [85, 72, 60]


def convertir(origen: Path) -> None:
    destino = origen.with_suffix(".webp")

    if destino.exists():
        print(f"  [SKIP] ya existe {destino.name}")
        return

    try:
        with Image.open(origen) as img:
            # Convertir a RGB si tiene canal alfa (PNG con transparencia)
            if img.mode in ("RGBA", "P"):
                fondo = Image.new("RGB", img.size, (255, 255, 255))
                fondo.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                img_rgb = fondo
            else:
                img_rgb = img.convert("RGB")

            guardado = False
            for calidad in CALIDADES:
                img_rgb.save(destino, "WEBP", quality=calidad, method=6)
                if destino.stat().st_size <= LIMITE_KB:
                    guardado = True
                    break
                # Si aún es muy grande, el próximo intento usará menor calidad

            if not guardado:
                # Último intento con calidad mínima — se guarda igual
                img_rgb.save(destino, "WEBP", quality=60, method=6)

        tam_orig = origen.stat().st_size // 1024
        tam_dest = destino.stat().st_size // 1024
        origen.unlink()  # borra el original
        print(f"  [OK] {origen.name}  →  {destino.name}  ({tam_orig} KB → {tam_dest} KB)")

    except Exception as e:
        print(f"  [ERROR] {origen.name}: {e}")
        if destino.exists():
            destino.unlink()


def main():
    archivos = [f for f in DIRECTORIO.iterdir() if f.suffix.lower() in EXTENSIONES]

    if not archivos:
        print("No se encontraron imágenes JPG/JPEG/PNG en esta carpeta.")
        return

    print(f"Encontradas {len(archivos)} imágenes. Convirtiendo...\n")
    for archivo in sorted(archivos):
        convertir(archivo)

    print("\nListo.")


if __name__ == "__main__":
    main()
