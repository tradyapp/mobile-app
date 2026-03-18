/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import {
  Block,
  List,
  ListInput,
  ListItem,
  Button,
  Checkbox,
} from "konsta/react";
import { userService } from "@/services/UserService";
import { UserType, UserFieldMetadata } from "@/types/UserType";

interface CompleteProfileScreenProps {
  uid: string;
  email: string;
  existingProfile: Partial<UserType> | null;
  missingFields: string[];
  schema: UserFieldMetadata[];
  onProfileCompleted: () => void;
}

export default function CompleteProfileScreen({
  uid,
  email,
  existingProfile,
  schema,
  onProfileCompleted,
}: CompleteProfileScreenProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Initialize form data from existing profile
  useEffect(() => {
    const initialData: Record<string, any> = { email };

    schema.forEach((field) => {
      if (existingProfile && field.name in existingProfile) {
        initialData[field.name] = existingProfile[field.name];
      } else {
        // Initialize with default values based on type
        const fieldType = field.type.toLowerCase();
        switch (fieldType) {
          case "bool":
          case "boolean":
            initialData[field.name] = false;
            break;
          case "string":
          case "country":
          case "email":
          case "tel":
            initialData[field.name] = "";
            break;
          case "number":
            initialData[field.name] = 0;
            break;
          case "date":
            initialData[field.name] = undefined;
            break;
          default:
            initialData[field.name] = "";
        }
      }
    });

    setFormData(initialData);
  }, [schema, existingProfile, email]);

  const validateForm = (): boolean => {
    const requiredFields = schema.filter((f) => f.required);

    for (const field of requiredFields) {
      const value = formData[field.name];
      const fieldType = field.type.toLowerCase();
      const fieldLabel = field.label || field.name;

      // Check for empty values
      if (value === undefined || value === null || value === "") {
        setError(`Please fill in: ${fieldLabel}`);
        return false;
      }

      // For booleans (agreements), must be true
      if (fieldType === "bool" || fieldType === "boolean") {
        const isAgreementField =
          field.name.toLowerCase().includes("agreed") ||
          field.name.toLowerCase().includes("tos");

        if (isAgreementField && !value) {
          setError(`You must accept: ${fieldLabel}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await userService.updateUserProfile(uid, formData);
      onProfileCompleted();
    } catch (err: any) {
      console.error("Error updating profile:", err);
      const detail = err?.message || err?.details || err?.code || JSON.stringify(err);
      setError(`Failed to update profile: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const renderBooleanField = (field: UserFieldMetadata) => {
    const value = formData[field.name];

    return (
      <ListItem
        key={field.name}
        label
        title={
          <div className="flex items-start gap-3">
            <Checkbox
              checked={value || false}
              onChange={(e) => updateField(field.name, e.target.checked)}
            />
            <span className="text-sm">
              {field.label || field.name}
              {field.description && (
                <span className="block text-xs text-zinc-500 mt-1">
                  {field.description}
                </span>
              )}
            </span>
          </div>
        }
      />
    );
  };

  const renderDateField = (field: UserFieldMetadata) => {
    const value = formData[field.name];
    const dateValue = value
      ? value instanceof Date
        ? value.toISOString().split("T")[0]
        : value
      : "";

    return (
      <ListInput
        key={field.name}
        label={(field.label || field.name) + (field.required ? " *" : "")}
        type="date"
        placeholder={field.placeholder}
        value={dateValue}
        onChange={(e) => updateField(field.name, new Date(e.target.value))}
        required={field.required}
      />
    );
  };

  const renderNumberField = (field: UserFieldMetadata) => {
    return (
      <ListInput
        key={field.name}
        label={(field.label || field.name) + (field.required ? " *" : "")}
        type="number"
        placeholder={field.placeholder}
        value={formData[field.name] || ""}
        onChange={(e) => updateField(field.name, parseFloat(e.target.value))}
        required={field.required}
      />
    );
  };

  const renderTextField = (field: UserFieldMetadata, type: string = "text") => {
    return (
      <ListInput
        key={field.name}
        label={(field.label || field.name) + (field.required ? " *" : "")}
        type={type}
        placeholder={field.placeholder}
        value={formData[field.name] || ""}
        onChange={(e) => updateField(field.name, e.target.value)}
        required={field.required}
      />
    );
  };

  const renderSelectField = (field: UserFieldMetadata) => {
    const options = (field.options ?? []).map((opt) => {
      const [value, label] = opt.includes(":") ? opt.split(":", 2) : [opt, opt];
      return { value, label };
    });

    return (
      <ListInput
        key={field.name}
        label={(field.label || field.name) + (field.required ? " *" : "")}
        type="select"
        value={formData[field.name] || ""}
        onChange={(e) => updateField(field.name, e.target.value)}
        required={field.required}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </ListInput>
    );
  };

  const renderField = (field: UserFieldMetadata) => {
    const fieldType = field.type.toLowerCase();

    if (field.options && field.options.length > 0) {
      return renderSelectField(field);
    }

    if (fieldType === "bool" || fieldType === "boolean") {
      return renderBooleanField(field);
    }

    if (fieldType === "date") {
      return renderDateField(field);
    }

    if (fieldType === "number") {
      return renderNumberField(field);
    }

    if (fieldType === "email") {
      return renderTextField(field, "email");
    }

    if (fieldType === "tel") {
      return renderTextField(field, "tel");
    }

    // String, Country, and other text fields
    return renderTextField(field, "text");
  };

  // Group fields by type for better UI organization
  const inputFields = schema.filter((f) => {
    const type = f.type.toLowerCase();
    return type !== "bool" && type !== "boolean";
  });

  const boolFields = schema.filter((f) => {
    const type = f.type.toLowerCase();
    return type === "bool" || type === "boolean";
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-y-auto pb-20">
      <Block className="mx-auto mt-8">
        <h1 className="text-2xl font-bold mb-2">Complete Your Profile</h1>
        <p className="text-zinc-400 mb-6">
          Please provide the following information to continue
        </p>

        {inputFields.length > 0 && (
          <List strong inset className="mb-4">
            {inputFields.map((field) => renderField(field))}
          </List>
        )}

        {boolFields.length > 0 && (
          <List strong inset className="mb-4">
            {boolFields.map((field) => renderField(field))}
          </List>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg mb-4">
            {error}
          </div>
        )}

        <Button
          large
          onClick={handleSubmit}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Saving..." : "Complete Profile"}
        </Button>
      </Block>
    </div>
  );
}
