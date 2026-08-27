import { Plus, Trash2, UploadCloud, X } from 'lucide-react';
import { CATEGORY_GROUPS } from '../../../lib/categories';
import type { PortfolioProjectDraft } from './types';

interface StepPortfolioProps {
  projects: PortfolioProjectDraft[];
  onProjectsChange: (projects: PortfolioProjectDraft[]) => void;
}

function createDraft(): PortfolioProjectDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: '',
    category: CATEGORY_GROUPS[0]?.label ?? '',
    description: '',
    tags: '',
    images: [],
  };
}

export function StepPortfolio({ projects, onProjectsChange }: StepPortfolioProps) {
  const updateProject = (id: string, updates: Partial<PortfolioProjectDraft>) => {
    onProjectsChange(projects.map((project) => (project.id === id ? { ...project, ...updates } : project)));
  };

  const removeProject = (id: string) => {
    const project = projects.find((item) => item.id === id);
    project?.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    onProjectsChange(projects.filter((item) => item.id !== id));
  };

  const addImages = (id: string, files: FileList | null) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const project = projects.find((item) => item.id === id);
    if (!project) return;

    const nextImages = imageFiles.slice(0, Math.max(10 - project.images.length, 0)).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    updateProject(id, { images: [...project.images, ...nextImages] });
  };

  const removeImage = (id: string, previewUrl: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    URL.revokeObjectURL(previewUrl);
    updateProject(id, { images: project.images.filter((image) => image.previewUrl !== previewUrl) });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700">Your portfolio</p>
        <p className="text-xs text-gray-500">Optional — you can add or edit more later from your freelancer dashboard.</p>
      </div>

      {projects.map((project) => (
        <div key={project.id} className="rounded-2xl border border-gray-200 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Portfolio Project</p>
            <button
              type="button"
              onClick={() => removeProject(project.id)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Project Title</label>
              <input
                value={project.title}
                onChange={(event) => updateProject(project.id, { title: event.target.value })}
                placeholder="Summer Wedding — Bangkok"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Category</label>
              <select
                value={project.category}
                onChange={(event) => updateProject(project.id, { category: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {CATEGORY_GROUPS.map((group) => (
                  <option key={group.id} value={group.label}>
                    {group.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Description</label>
              <textarea
                value={project.description}
                onChange={(event) => updateProject(project.id, { description: event.target.value })}
                rows={2}
                placeholder="Outdoor wedding photography..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Tags (comma separated)</label>
              <input
                value={project.tags}
                onChange={(event) => updateProject(project.id, { tags: event.target.value })}
                placeholder="Wedding, Outdoor, Cinematic, Warm"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Images</label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-600 hover:border-gray-500">
                <UploadCloud className="h-4 w-4" />
                Upload Images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    addImages(project.id, event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>

              {project.images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {project.images.map((image) => (
                    <div key={image.previewUrl} className="relative h-20 w-20 overflow-hidden rounded-xl">
                      <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(project.id, image.previewUrl)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onProjectsChange([...projects, createDraft()])}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:border-gray-500"
      >
        <Plus className="h-4 w-4" /> Add Portfolio Work
      </button>
    </div>
  );
}
