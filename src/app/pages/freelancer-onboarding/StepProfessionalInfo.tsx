import { User } from 'lucide-react';
import { ProfileImageDropzone, type ImageUpload } from '../../../components/common/ProfileImageDropzone';
import { PRONOUN_OPTIONS } from '../../../lib/pronouns';

interface StepProfessionalInfoProps {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  pronouns: string;
  onPronounsChange: (value: string) => void;
  pronounsCustom: string;
  onPronounsCustomChange: (value: string) => void;
  bio: string;
  onBioChange: (value: string) => void;
  profilePictureUpload: ImageUpload | null;
  existingAvatarUrl?: string | null;
  isDraggingProfilePicture: boolean;
  onProfilePictureDragChange: (isDragging: boolean) => void;
  onProfilePictureChange: (file: File) => void;
  onProfilePictureRemove: () => void;
  coverPhotoUpload: ImageUpload | null;
  isDraggingCoverPhoto: boolean;
  onCoverPhotoDragChange: (isDragging: boolean) => void;
  onCoverPhotoChange: (file: File) => void;
  onCoverPhotoRemove: () => void;
}

export function StepProfessionalInfo({
  displayName,
  onDisplayNameChange,
  pronouns,
  onPronounsChange,
  pronounsCustom,
  onPronounsCustomChange,
  bio,
  onBioChange,
  profilePictureUpload,
  existingAvatarUrl,
  isDraggingProfilePicture,
  onProfilePictureDragChange,
  onProfilePictureChange,
  onProfilePictureRemove,
  coverPhotoUpload,
  isDraggingCoverPhoto,
  onCoverPhotoDragChange,
  onCoverPhotoChange,
  onCoverPhotoRemove,
}: StepProfessionalInfoProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-semibold text-gray-700">Professional Display Name</label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder="Luna Photography"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">Shown publicly instead of your legal name.</p>
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-semibold text-gray-700">Pronouns (optional)</label>
        <div className="flex flex-wrap gap-2">
          {PRONOUN_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onPronounsChange(option)}
              className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
                pronouns === option ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {pronouns === 'Custom' && (
          <input
            value={pronounsCustom}
            onChange={(event) => onPronounsCustomChange(event.target.value)}
            placeholder="e.g. ze/zir"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        )}
      </div>

      <ProfileImageDropzone
        label="Profile Photo"
        helper="Strongly recommended — square images work best."
        upload={profilePictureUpload}
        existingImageUrl={existingAvatarUrl}
        isDragging={isDraggingProfilePicture}
        previewClassName="h-40 w-40 rounded-full object-cover"
        onDragChange={onProfilePictureDragChange}
        onChange={onProfilePictureChange}
        onRemove={onProfilePictureRemove}
      />

      <ProfileImageDropzone
        label="Cover Photo (optional)"
        helper="Use a wide image that represents your work."
        upload={coverPhotoUpload}
        isDragging={isDraggingCoverPhoto}
        previewClassName="h-40 w-full rounded-xl object-cover"
        onDragChange={onCoverPhotoDragChange}
        onChange={onCoverPhotoChange}
        onRemove={onCoverPhotoRemove}
      />

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-semibold text-gray-700">Short Bio</label>
        <textarea
          value={bio}
          onChange={(event) => onBioChange(event.target.value)}
          rows={4}
          placeholder="Professional wedding photographer specializing in outdoor and cinematic-style photography."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
    </div>
  );
}
