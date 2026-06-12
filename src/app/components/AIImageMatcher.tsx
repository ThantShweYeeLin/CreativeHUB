import { X, Upload, Sparkles, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface AIImageMatcherProps {
  onClose: () => void;
  onSearch: (images: File[]) => void;
}

export function AIImageMatcher({ onClose, onSearch }: AIImageMatcherProps) {
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setUploadedImages(prev => [...prev, ...imageFiles].slice(0, 6)); // Max 6 images
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSearch = () => {
    if (uploadedImages.length > 0) {
      onSearch(uploadedImages);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">AI Image Matcher</h2>
              <p className="text-sm text-gray-600">Upload inspiration photos to find matching freelancers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-12 transition-all ${
              dragActive
                ? 'border-gray-500 bg-gray-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-upload"
            />
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-10 h-10 text-gray-900" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Your Inspirations</h3>
              <p className="text-gray-600 mb-4">Drag and drop images here, or click to browse</p>
              <p className="text-sm text-gray-500">Support: JPG, PNG, GIF (Max 6 images)</p>
            </div>
          </div>

          {/* Uploaded Images Grid */}
          {uploadedImages.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Uploaded Images ({uploadedImages.length}/6)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {uploadedImages.map((file, index) => (
                  <div key={index} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => removeImage(index)}
                        className="p-2 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-white" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{file.name}</p>
                    </div>
                  </div>
                ))}

                {/* Add More Button */}
                {uploadedImages.length < 6 && (
                  <label
                    htmlFor="file-upload"
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-500 flex items-center justify-center cursor-pointer transition-all group"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-100 group-hover:bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors">
                        <ImageIcon className="w-6 h-6 text-gray-600 group-hover:text-gray-900 transition-colors" />
                      </div>
                      <p className="text-sm font-medium text-gray-600">Add More</p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border-2 border-gray-100">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-gray-900 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-gray-900 mb-2">How it works</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Upload photos that match your desired style</li>
                  <li>• Our AI analyzes colors, composition, and aesthetics</li>
                  <li>• Get matched with freelancers who have similar portfolio work</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 rounded-b-3xl flex items-center justify-between">
          <button
            onClick={() => setUploadedImages([])}
            disabled={uploadedImages.length === 0}
            className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
          <button
            onClick={handleSearch}
            disabled={uploadedImages.length === 0}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Sparkles className="w-5 h-5" />
            <span>Find Matching Freelancers</span>
          </button>
        </div>
      </div>
    </div>
  );
}
