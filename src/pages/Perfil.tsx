import { useEffect, useState } from "react";
import { getSetting, setSetting } from "../lib/tauriApi";
import { isTauriApp } from "../lib/tauriEnv";

function Perfil() {
  const [name, setName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storedPhoto, setStoredPhoto] = useState<string | null>(null);
  const [storedName, setStoredName] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isTauriApp()) {
      return;
    }
    const load = async () => {
      const [nameValue, photoValue] = await Promise.all([
        getSetting("profile_name"),
        getSetting("profile_photo"),
      ]);
      const nextName = nameValue ?? "";
      setName(nextName);
      setStoredName(nextName);
      setStoredPhoto(photoValue ?? null);
      setPreviewUrl(photoValue ?? null);
    };
    load();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPreviewUrl(storedPhoto);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Editar perfil</h2>
          <p className="mt-2 text-sm text-slate-500">
            Atualize seu nome e foto do perfil.
          </p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-6">
          <label className={`flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-slate-400 ${isEditing ? "cursor-pointer" : "cursor-default"}`}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Foto do perfil"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M15 2H9v2H7v6h2V4h6zm0 8H9v2h6zm0-6h2v6h-2zM4 16h2v-2h12v2H6v4h12v-4h2v6H4z"
                />
              </svg>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={!isEditing}
              className="hidden"
            />
          </label>
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-slate-600">
              Nome
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                disabled={!isEditing}
                className={`mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 ${isEditing ? "" : "bg-slate-50 text-slate-500"}`}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setName(storedName);
                      setPreviewUrl(storedPhoto);
                      setIsEditing(false);
                    }}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 shadow-soft"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!isTauriApp()) {
                        setIsEditing(false);
                        return;
                      }
                      const trimmed = name.trim();
                      await Promise.all([
                        setSetting("profile_name", trimmed),
                        setSetting("profile_photo", previewUrl ?? ""),
                      ]);
                      setStoredName(trimmed);
                      setStoredPhoto(previewUrl);
                      setIsEditing(false);
                      window.dispatchEvent(new Event("profile-updated"));
                    }}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-soft"
                  >
                    Salvar perfil
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 shadow-soft"
                >
                  Editar perfil
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Perfil;
