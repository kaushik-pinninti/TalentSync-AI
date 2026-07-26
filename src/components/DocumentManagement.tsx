import React, { useState, useEffect, useRef } from "react";
import { 
  Folder, FolderPlus, FileText, Image, Award, Briefcase, File, Trash2, 
  Download, UploadCloud, Search, Plus, X, ChevronRight, Clock, Lock, 
  Unlock, Shield, Users, Edit3, Check, Filter, AlertTriangle, RefreshCw, 
  FileUp, Copy, Eye, FileCode, Bot
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Version {
  version_id: string;
  name: string;
  file_size: string;
  uploaded_at: string;
  content: string;
  uploaded_by: string;
  note: string;
}

interface DocumentItem {
  id: number;
  name: string;
  type: "PDF" | "DOCX" | "Image" | "Certificate" | "Portfolio" | "Other";
  file_size: string;
  folder: string;
  uploaded_by: string;
  uploaded_at: string;
  role_permissions: string[];
  mime_type: string;
  content?: string;
  versions?: Version[];
}

interface DocumentManagementProps {
  token: string;
  user: { id: number; email: string; name: string; company: string; role?: string } | null;
}

export default function DocumentManagement({ token, user }: DocumentManagementProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedFolder, setSelectedFolder] = useState<string>("All Folders");
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem("ts_custom_folders");
    return saved ? JSON.parse(saved) : ["Resumes", "Certificates", "Contracts", "Portfolio Files", "Unsorted"];
  });
  
  // Create folder modal state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedUploadType, setSelectedUploadType] = useState<DocumentItem["type"]>("PDF");
  const [selectedUploadFolder, setSelectedUploadFolder] = useState<string>("Unsorted");
  const [selectedUploadPermissions, setSelectedUploadPermissions] = useState<string[]>(["all"]);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected document drawer
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [loadingDocDetail, setLoadingDocDetail] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  // Version Upload State
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionNote, setNewVersionNote] = useState("");
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const versionFileInputRef = useRef<HTMLInputElement>(null);

  // Edit Metadata State
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState("");
  const [editFolder, setEditFolder] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [updatingMetadata, setUpdatingMetadata] = useState(false);

  // Load documents
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      } else {
        console.error("Error loading documents:", data.error);
      }
    } catch (err) {
      console.error("Network error fetching documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [token]);

  // Persist custom folders
  useEffect(() => {
    localStorage.setItem("ts_custom_folders", JSON.stringify(customFolders));
  }, [customFolders]);

  // Fetch specific document details (including base64 content and versions) for preview/download
  const fetchDocDetails = async (id: number) => {
    setLoadingDocDetail(true);
    setPreviewContent(null);
    try {
      const res = await fetch(`/api/documents/${id}/download`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewContent(data.content);
        // Find document in list and refresh details with versions
        const fullDocRes = await fetch("/api/documents", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const fullDocData = await fullDocRes.json();
        if (fullDocRes.ok) {
          const updatedList = fullDocData.documents || [];
          setDocuments(updatedList);
          const found = updatedList.find((d: any) => d.id === id);
          if (found) {
            setActiveDoc({
              ...found,
              content: data.content // Inject full content
            });
            // Setup initial values for edit metadata
            setEditName(found.name);
            setEditFolder(found.folder);
            setEditPermissions(found.role_permissions || ["all"]);
          }
        }
      } else {
        alert("Failed to fetch secure file preview: " + data.error);
      }
    } catch (err) {
      console.error("Error fetching doc details:", err);
    } finally {
      setLoadingDocDetail(false);
    }
  };

  useEffect(() => {
    if (activeDocId !== null) {
      fetchDocDetails(activeDocId);
    } else {
      setActiveDoc(null);
      setPreviewContent(null);
      setIsEditingMetadata(false);
    }
  }, [activeDocId]);

  // Helper: File Type Icon selector
  const getTypeIcon = (type: string, sizeClass = "h-5 w-5") => {
    switch (type) {
      case "PDF":
        return <FileText className={`${sizeClass} text-rose-400`} />;
      case "DOCX":
        return <File className={`${sizeClass} text-blue-400`} />;
      case "Image":
        return <Image className={`${sizeClass} text-emerald-400`} />;
      case "Certificate":
        return <Award className={`${sizeClass} text-amber-400`} />;
      case "Portfolio":
        return <Briefcase className={`${sizeClass} text-indigo-400`} />;
      default:
        return <FileCode className={`${sizeClass} text-slate-400`} />;
    }
  };

  // Create new folder
  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    if (customFolders.map(f => f.toLowerCase()).includes(trimmed.toLowerCase())) {
      alert("Folder already exists.");
      return;
    }
    setCustomFolders([...customFolders, trimmed]);
    setNewFolderName("");
    setShowNewFolderModal(false);
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle Drag Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Main File Upload
  const handleFileUpload = async (file: File) => {
    setUploadError("");
    setUploadProgress(10);
    try {
      // Format file size
      const sizeInMB = file.size / (1024 * 1024);
      let sizeStr = "";
      if (sizeInMB < 0.1) {
        sizeStr = `${Math.round(file.size / 1024)} KB`;
      } else {
        sizeStr = `${sizeInMB.toFixed(2)} MB`;
      }

      if (sizeInMB > 15) {
        setUploadError("File exceeds the maximum limit of 15MB");
        setUploadProgress(null);
        return;
      }

      setUploadProgress(30);
      const base64Content = await fileToBase64(file);
      setUploadProgress(60);

      // Guess type based on extension if not adjusted
      let guessedType: DocumentItem["type"] = selectedUploadType;
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "pdf") guessedType = "PDF";
      else if (["doc", "docx"].includes(extension || "")) guessedType = "DOCX";
      else if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(extension || "")) guessedType = "Image";

      const payload = {
        name: file.name,
        type: guessedType,
        file_size: sizeStr,
        folder: selectedUploadFolder,
        content: base64Content,
        mime_type: file.type || "application/octet-stream",
        role_permissions: selectedUploadPermissions
      };

      setUploadProgress(80);
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setUploadProgress(100);

      if (res.ok) {
        // Refresh list
        await fetchDocuments();
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setUploadProgress(null), 1000);
      } else {
        setUploadError(data.error || "Failed to upload document");
        setUploadProgress(null);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError("Network/parsing error occurred during upload.");
      setUploadProgress(null);
    }
  };

  // Delete Document
  const handleDeleteDoc = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this document?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments(documents.filter(d => d.id !== id));
        setActiveDocId(null);
      } else {
        alert("Failed to delete: " + data.error);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Download File securely (Trigger client browser download)
  const handleSecureDownload = (doc: DocumentItem, targetVersion?: Version) => {
    try {
      const content = targetVersion ? targetVersion.content : doc.content || previewContent;
      if (!content) {
        alert("File content is currently unavailable. Please wait for it to load completely.");
        return;
      }
      
      const fileName = targetVersion ? targetVersion.name : doc.name;
      const mimeType = doc.mime_type || "application/octet-stream";

      const link = window.document.createElement("a");
      link.href = content;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to secure download:", err);
      alert("Error generating download link.");
    }
  };

  // Update Metadata (Folder & Permissions)
  const handleUpdateMetadata = async () => {
    if (!activeDoc) return;
    setUpdatingMetadata(true);
    try {
      const res = await fetch(`/api/documents/${activeDoc.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          folder: editFolder,
          role_permissions: editPermissions
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh local list
        setDocuments(documents.map(d => d.id === activeDoc.id ? { 
          ...d, 
          name: editName, 
          folder: editFolder, 
          role_permissions: editPermissions 
        } : d));
        
        setActiveDoc({
          ...activeDoc,
          name: editName,
          folder: editFolder,
          role_permissions: editPermissions
        });
        
        setIsEditingMetadata(false);
      } else {
        alert("Failed to update settings: " + data.error);
      }
    } catch (err) {
      console.error("Error updating metadata:", err);
    } finally {
      setUpdatingMetadata(false);
    }
  };

  // Upload New Version (Resume Versioning)
  const handleUploadVersion = async () => {
    if (!activeDoc || !newVersionFile) return;
    setUploadingVersion(true);
    try {
      const base64Content = await fileToBase64(newVersionFile);
      
      // Format file size
      const sizeInMB = newVersionFile.size / (1024 * 1024);
      let sizeStr = "";
      if (sizeInMB < 0.1) {
        sizeStr = `${Math.round(newVersionFile.size / 1024)} KB`;
      } else {
        sizeStr = `${sizeInMB.toFixed(2)} MB`;
      }

      const res = await fetch(`/api/documents/${activeDoc.id}/version`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newVersionFile.name,
          file_size: sizeStr,
          content: base64Content,
          note: newVersionNote || "Manual document version upgrade"
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Refresh document details
        await fetchDocDetails(activeDoc.id);
        setNewVersionFile(null);
        setNewVersionNote("");
        if (versionFileInputRef.current) versionFileInputRef.current.value = "";
      } else {
        alert("Failed to upload version: " + data.error);
      }
    } catch (err) {
      console.error("Failed to upload version:", err);
    } finally {
      setUploadingVersion(false);
    }
  };

  // Toggle permission role
  const handleTogglePermissionRole = (role: string) => {
    if (role === "all") {
      setEditPermissions(["all"]);
    } else {
      let updated = editPermissions.filter(r => r !== "all");
      if (updated.includes(role)) {
        updated = updated.filter(r => r !== role);
      } else {
        updated.push(role);
      }
      if (updated.length === 0) {
        updated = ["all"];
      }
      setEditPermissions(updated);
    }
  };

  // Filter & Search Documents logic
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.uploaded_by.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.folder.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === "All" || doc.type === selectedType;
    
    const matchesFolder = selectedFolder === "All Folders" || doc.folder === selectedFolder;
    
    return matchesSearch && matchesType && matchesFolder;
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome Title Grid */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-extrabold text-white tracking-tight font-sans">Enterprise Document Vault</h2>
          <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
            Secure multi-user repository with Role-Based Access Control (RBAC), automatic Base64 sandboxed storage, and Resume Versioning.
          </p>
        </div>
        <div className="flex gap-2 relative z-10">
          <button
            id="refresh-docs-btn"
            onClick={fetchDocuments}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-neutral-300 transition cursor-pointer"
            title="Refresh repository list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            id="create-folder-btn"
            onClick={() => setShowNewFolderModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-600/10"
          >
            <FolderPlus className="h-4 w-4" />
            <span>Create Folder</span>
          </button>
        </div>
      </div>

      {/* Main Core Layout: Sidebar Folders + Document Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar: Folder Directories & Types Filters */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Folders List Container */}
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-4 px-1 flex items-center justify-between font-mono">
              <span>Folders</span>
              <span className="text-[9px] font-mono lowercase text-neutral-300 bg-white/5 px-2 py-0.5 rounded-full font-semibold border border-white/10">
                {customFolders.length} folders
              </span>
            </h3>
            
            <div className="space-y-1">
              <button
                id="folder-all-folders"
                onClick={() => setSelectedFolder("All Folders")}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  selectedFolder === "All Folders"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 shrink-0" />
                  <span>All Folders</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${selectedFolder === "All Folders" ? "bg-indigo-700 text-white" : "bg-white/5 text-neutral-400 border border-white/5"}`}>
                  {documents.length}
                </span>
              </button>

              {customFolders.map((folder) => {
                const count = documents.filter(d => d.folder === folder).length;
                const isSel = selectedFolder === folder;
                return (
                  <button
                    id={`folder-item-${folder.replace(/\s+/g, "-").toLowerCase()}`}
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      isSel
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className={`h-4 w-4 shrink-0 ${isSel ? "text-white" : "text-neutral-500"}`} />
                      <span className="truncate">{folder}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${isSel ? "bg-indigo-700 text-white" : "bg-white/5 text-neutral-400 border border-white/5"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type Selector Filter */}
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-4 px-1 font-mono">
              File Type Categories
            </h3>
            <div className="space-y-1">
              {[
                { id: "All", label: "All Document Formats", icon: File },
                { id: "PDF", label: "PDF Resumes & Sheets", icon: FileText },
                { id: "DOCX", label: "Word (DOCX) Files", icon: File },
                { id: "Image", label: "Photos & Images", icon: Image },
                { id: "Certificate", label: "Award Certificates", icon: Award },
                { id: "Portfolio", label: "Portfolios & Projects", icon: Briefcase },
              ].map((category) => {
                const Icon = category.icon;
                const isSel = selectedType === category.id;
                return (
                  <button
                    id={`type-filter-${category.id.toLowerCase()}`}
                    key={category.id}
                    onClick={() => setSelectedType(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                      isSel
                        ? "bg-white/10 text-white font-bold border border-white/10"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 text-neutral-450`} />
                      <span>{category.label}</span>
                    </div>
                    {isSel && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick RBAC Role Policy Indicator Card */}
          <div className="bg-indigo-600/10 border border-indigo-500/15 rounded-2xl p-4 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <Shield className="h-4 w-4 text-indigo-400 animate-pulse" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 font-mono">Security Gateway Policy</h4>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed font-sans relative z-10">
              Your logged role is <b className="text-white font-bold capitalize">"{user?.role || "recruiter"}"</b>. 
              Documents tagged as private or restricted will be hidden unless you hold matching administrative credentials.
            </p>
          </div>

        </div>

        {/* Right Pane: Upload Area + Document Grid */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* File Upload Zone (With Drag & Drop support) */}
          <div
            id="drag-drop-uploader"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition relative overflow-hidden group ${
              isDragging 
                ? "border-indigo-500 bg-indigo-600/5 scale-[0.99]" 
                : "border-white/10 hover:border-white/20 glass-panel"
            }`}
          >
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.svg"
            />
            
            <div className="max-w-md mx-auto space-y-4 relative z-10">
              <div className="mx-auto h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center text-indigo-400 border border-white/10 group-hover:scale-110 transition duration-300">
                <UploadCloud className="h-6 w-6" />
              </div>
              
              <div>
                <p className="text-xs font-bold text-white">
                  Drag & drop your document here, or{" "}
                  <button 
                    onClick={triggerFileSelect} 
                    className="text-indigo-400 font-extrabold hover:underline cursor-pointer"
                  >
                    browse computer
                  </button>
                </p>
                <p className="text-[10px] text-neutral-450 mt-1 font-medium">
                  Supports PDF, DOCX, Images, Certificates, & Portfolio Files (Max 15MB)
                </p>
              </div>

              {/* Upload Configuration Tray */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                {/* Format selection */}
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-tight mb-1 font-mono">Format</label>
                  <select
                    id="upload-type-selector"
                    value={selectedUploadType}
                    onChange={(e) => setSelectedUploadType(e.target.value as any)}
                    className="w-full bg-[#121215] border border-white/10 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-200 cursor-pointer focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PDF" className="bg-[#121215]">PDF Resume/File</option>
                    <option value="DOCX" className="bg-[#121215]">Microsoft Word (DOCX)</option>
                    <option value="Image" className="bg-[#121215]">JPEG/PNG Image</option>
                    <option value="Certificate" className="bg-[#121215]">Award/Certificate</option>
                    <option value="Portfolio" className="bg-[#121215]">Portfolio Project</option>
                  </select>
                </div>

                {/* Target Folder */}
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-tight mb-1 font-mono">Target Folder</label>
                  <select
                    id="upload-folder-selector"
                    value={selectedUploadFolder}
                    onChange={(e) => setSelectedUploadFolder(e.target.value)}
                    className="w-full bg-[#121215] border border-white/10 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-200 cursor-pointer focus:outline-none focus:border-indigo-500"
                  >
                    {customFolders.map(folder => (
                      <option key={folder} value={folder} className="bg-[#121215]">{folder}</option>
                    ))}
                  </select>
                </div>

                {/* Permissions policies */}
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-tight mb-1 font-mono">RBAC Visibility</label>
                  <select
                    id="upload-rbac-selector"
                    value={selectedUploadPermissions[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "all") setSelectedUploadPermissions(["all"]);
                      else if (val === "admin") setSelectedUploadPermissions(["admin"]);
                      else if (val === "recruiter") setSelectedUploadPermissions(["recruiter"]);
                    }}
                    className="w-full bg-[#121215] border border-white/10 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-200 cursor-pointer focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all" className="bg-[#121215]">Public (All Roles)</option>
                    <option value="recruiter" className="bg-[#121215]">Recruiter Restricted</option>
                    <option value="admin" className="bg-[#121215]">Admin Only</option>
                  </select>
                </div>
              </div>

              {/* Progress and status reports */}
              {uploadProgress !== null && (
                <div className="space-y-1.5 max-w-xs mx-auto">
                  <div className="flex justify-between text-[10px] font-bold text-neutral-300">
                    <span>Encoding & Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-1 rounded-full transition-all duration-300 animate-pulse" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-semibold rounded-xl flex items-center justify-center gap-1.5 max-w-xs mx-auto">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Search, Stats Counter & Grid Control toolbar */}
          <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
              <input
                id="docs-search-field"
                type="text"
                placeholder="Search file, category, owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:bg-[#09090b]/40 transition duration-300"
              />
            </div>

            {/* Current filters details */}
            <div className="flex items-center gap-3 text-xs text-neutral-400 font-semibold self-end sm:self-center">
              <span>Showing <b>{filteredDocuments.length}</b> of <b>{documents.length}</b> items</span>
              {(selectedType !== "All" || selectedFolder !== "All Folders" || searchQuery) && (
                <button
                  id="clear-filters-btn"
                  onClick={() => {
                    setSelectedType("All");
                    setSelectedFolder("All Folders");
                    setSearchQuery("");
                  }}
                  className="text-[10px] text-indigo-400 hover:underline font-bold cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Documents Grid / list view */}
          {loading ? (
            <div className="glass-panel p-12 text-center rounded-2xl">
              <RefreshCw className="h-8 w-8 text-neutral-500 animate-spin mx-auto mb-3" />
              <p className="text-xs text-neutral-400 font-medium">Loading secure document collection...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-2xl">
              <File className="h-10 w-10 text-neutral-500 mx-auto mb-3" />
              <p className="text-xs font-bold text-neutral-300">No documents found matching filters</p>
              <p className="text-[11px] text-neutral-450 mt-1">Upload a new document or modify your folder filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
              {filteredDocuments.map((doc) => {
                const isOwner = doc.uploaded_by === user?.email;
                const permissions = doc.role_permissions || ["all"];
                const isRestricted = !permissions.includes("all");
                const hasVersions = doc.versions && doc.versions.length > 0;
                
                return (
                  <div
                    id={`doc-card-${doc.id}`}
                    key={doc.id}
                    className="glass-panel border-white/5 hover:border-white/15 rounded-2xl p-4.5 transition duration-300 flex flex-col justify-between group h-[200px] relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/2 rounded-full blur-xl pointer-events-none" />
                    {/* Top row details */}
                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-2">
                        {getTypeIcon(doc.type)}
                        
                        <div className="flex items-center gap-1.5">
                          {/* Folder badge */}
                          <span className="text-[9px] font-bold bg-white/5 text-neutral-300 px-2 py-0.5 rounded-full uppercase tracking-wide truncate max-w-[80px] border border-white/10" title={`Folder: ${doc.folder}`}>
                            {doc.folder}
                          </span>
                          
                          {/* Visibility badge */}
                          {isRestricted ? (
                            <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5" title="Restricted access settings">
                              <Lock className="h-2.5 w-2.5" />
                              <span>RBAC</span>
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5" title="Public access settings">
                              <Unlock className="h-2.5 w-2.5" />
                              <span>Public</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-xs font-bold text-white line-clamp-1 break-all group-hover:text-indigo-300 transition" title={doc.name}>
                          {doc.name}
                        </h4>
                        
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-450 mt-1.5 font-mono">
                          <span>{doc.file_size}</span>
                          <span>•</span>
                          <span className="bg-white/5 text-neutral-300 px-1.5 py-0.2 rounded-full font-bold uppercase text-[8px] tracking-wider border border-white/5">
                            {doc.type}
                          </span>
                          {hasVersions && (
                            <span className="bg-indigo-600 text-white px-1.5 py-0.2 rounded-full text-[8px] font-bold font-mono">
                              v{doc.versions!.length + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Metadata & actions */}
                    <div className="border-t border-white/5 pt-3.5 mt-3.5 flex items-center justify-between relative z-10">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-neutral-500 font-medium">Uploaded by</span>
                        <span className="text-[10px] text-neutral-300 font-bold truncate max-w-[110px]" title={doc.uploaded_by}>
                          {isOwner ? "You" : doc.uploaded_by}
                        </span>
                      </div>

                      {/* Card actions */}
                      <div className="flex items-center gap-1 opacity-90 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button
                          id={`doc-action-preview-${doc.id}`}
                          onClick={() => setActiveDocId(doc.id)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-300 hover:text-white transition cursor-pointer"
                          title="Open document detail drawer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        
                        {/* Delete trigger */}
                        {(user?.role === "admin" || isOwner) && (
                          <button
                            id={`doc-action-delete-${doc.id}`}
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1.5 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-xl text-neutral-300 hover:text-red-400 transition cursor-pointer"
                            title="Delete file permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* Slide-over document detail Drawer */}
      <AnimatePresence>
        {activeDocId && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDocId(null)}
              className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm"
            />

            {/* Slide over Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-xl bg-[#09090b]/95 border-l border-white/10 shadow-2xl h-full flex flex-col z-10 backdrop-blur-md"
            >
              
              {/* Drawer Header */}
              <div className="p-5 border-b border-white/10 bg-white/2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeDoc && getTypeIcon(activeDoc.type, "h-6 w-6")}
                  <div>
                    <h3 className="text-sm font-bold text-white truncate max-w-[280px]" title={activeDoc?.name}>
                      {activeDoc?.name}
                    </h3>
                    <p className="text-[10px] text-neutral-450 mt-0.5 font-mono">
                      Secure file manager ID &bull; #{activeDoc?.id}
                    </p>
                  </div>
                </div>
                
                <button
                  id="close-drawer-btn"
                  onClick={() => setActiveDocId(null)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Drawer Content Area */}
              {loadingDocDetail || !activeDoc ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-neutral-400 font-medium">
                  <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
                  <span>Loading full document details and metadata...</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">

                  {/* Top quick download button */}
                  <div className="flex gap-2">
                    <button
                      id="drawer-download-primary"
                      onClick={() => handleSecureDownload(activeDoc)}
                      className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/10"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Secure Original</span>
                    </button>
                    
                    <button
                      id="toggle-edit-metadata-btn"
                      onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                      className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-neutral-300 transition cursor-pointer"
                    >
                      Settings
                    </button>
                  </div>

                  {/* Metadata Settings Editor Panel */}
                  {isEditingMetadata && (
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Edit3 className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Document Settings Manager</span>
                      </h4>

                      <div className="space-y-3 text-xs">
                        {/* Name Change */}
                        <div>
                          <label className="block text-[10px] text-neutral-400 uppercase tracking-wide font-bold mb-1 font-mono">Document Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:bg-[#0d0d12]"
                          />
                        </div>

                        {/* Move Folder selection */}
                        <div>
                          <label className="block text-[10px] text-neutral-400 uppercase tracking-wide font-bold mb-1 font-mono">Move to Folder Directory</label>
                          <select
                            value={editFolder}
                            onChange={(e) => setEditFolder(e.target.value)}
                            className="w-full bg-[#0d0d12] border border-white/10 rounded-xl px-2.5 py-2 text-white focus:outline-none cursor-pointer focus:border-indigo-500"
                          >
                            {customFolders.map(folder => (
                              <option key={folder} value={folder} className="bg-[#0d0d12]">{folder}</option>
                            ))}
                          </select>
                        </div>

                        {/* RBAC Policies config */}
                        <div>
                          <label className="block text-[10px] text-neutral-400 uppercase tracking-wide font-bold mb-1.5 font-mono">RBAC Permissions Visibility</label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleTogglePermissionRole("all")}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${
                                editPermissions.includes("all")
                                  ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/40"
                                  : "bg-white/5 text-neutral-400 border-white/5"
                              }`}
                            >
                              Public (All Roles)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePermissionRole("recruiter")}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${
                                editPermissions.includes("recruiter")
                                  ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/40"
                                  : "bg-white/5 text-neutral-400 border-white/5"
                              }`}
                            >
                              Recruiter Allowed
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePermissionRole("admin")}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${
                                editPermissions.includes("admin")
                                  ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/40"
                                  : "bg-white/5 text-neutral-400 border-white/5"
                              }`}
                            >
                              Admin Only
                            </button>
                          </div>
                        </div>

                        {/* Save Trigger */}
                        <button
                          type="button"
                          onClick={handleUpdateMetadata}
                          disabled={updatingMetadata}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                        >
                          {updatingMetadata ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          <span>Apply Configuration Settings</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Base64 Sandbox Preview Block */}
                  {previewContent && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider font-mono">Sandboxed Content Preview</h4>
                      <div className="w-full h-44 bg-black/40 border border-white/10 rounded-2xl p-4 overflow-y-auto text-neutral-300 text-[11px] font-mono whitespace-pre-wrap leading-relaxed select-text custom-scrollbar">
                        {previewContent.startsWith("data:") ? (
                          <div className="text-center py-8 text-neutral-550">
                            <FileCode className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
                            <span>Binary file content loaded securely in virtual sandbox. Download to view formatted content.</span>
                          </div>
                        ) : (
                          previewContent
                        )}
                      </div>
                    </div>
                  )}

                  {/* Version History / Resume Versioning Logs */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider font-mono">
                      <Clock className="h-4 w-4 text-indigo-400" />
                      <span>Resume Versioning History</span>
                    </h4>

                    <div className="space-y-2.5">
                      {/* Active Version item */}
                      <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-4 flex items-start justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-full blur-lg pointer-events-none" />
                        <div className="space-y-1 relative z-10">
                          <div className="flex items-center gap-2">
                            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[9px] font-bold font-mono">
                              v{activeDoc.versions ? activeDoc.versions.length + 1 : 1}
                            </span>
                            <span className="text-xs font-bold text-white truncate max-w-[200px]" title={activeDoc.name}>{activeDoc.name}</span>
                            <span className="text-[10px] text-neutral-400 font-medium">({activeDoc.file_size})</span>
                          </div>
                          <p className="text-[10px] text-neutral-400 leading-relaxed font-mono">
                            Committed by you &bull; {new Date(activeDoc.uploaded_at).toLocaleString()}
                          </p>
                          <span className="text-[10px] text-neutral-300 font-sans block pt-1 italic">
                            &ldquo;Initial production document ingestion screening.&rdquo;
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-bold text-indigo-400 rounded-full font-mono">
                          Current
                        </span>
                      </div>

                      {/* Older versions */}
                      {activeDoc.versions && activeDoc.versions.map((ver, idx) => (
                        <div key={ver.version_id} className="bg-white/2 border border-white/5 rounded-2xl p-4 flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="bg-white/10 text-neutral-300 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono">
                                v{idx + 1}
                              </span>
                              <span className="text-xs font-bold text-neutral-300 truncate max-w-[200px]" title={ver.name}>{ver.name}</span>
                              <span className="text-[10px] text-neutral-450 font-medium">({ver.file_size})</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 leading-relaxed font-mono">
                              Committed by {ver.uploaded_by} &bull; {new Date(ver.uploaded_at).toLocaleString()}
                            </p>
                            <span className="text-[10px] text-neutral-400 font-sans block pt-1 italic">
                              &ldquo;{ver.note}&rdquo;
                            </span>
                          </div>

                          <button
                            id={`download-ver-btn-${ver.version_id}`}
                            onClick={() => handleSecureDownload(activeDoc, ver)}
                            className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer"
                            title="Download this historic version"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Commit new Version Upgrade form */}
                    <div className="bg-white/2 border border-white/5 rounded-2xl p-4 space-y-3.5">
                      <h5 className="text-[11px] font-bold text-white uppercase tracking-wider font-mono">Commit Subsequent File Revision</h5>
                      <div className="space-y-3 text-xs">
                        <div>
                          <input
                            type="file"
                            ref={versionFileInputRef}
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                setNewVersionFile(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => versionFileInputRef.current?.click()}
                            className="w-full py-2.5 border border-dashed border-white/10 hover:border-white/20 bg-white/5 rounded-xl text-neutral-400 hover:text-white transition flex items-center justify-center gap-2 cursor-pointer font-bold"
                          >
                            <Plus className="h-4 w-4" />
                            <span>{newVersionFile ? newVersionFile.name : "Select subsequent version file"}</span>
                          </button>
                        </div>

                        {newVersionFile && (
                          <>
                            <div>
                              <label className="block text-[10px] text-neutral-400 uppercase tracking-wide font-bold mb-1.5 font-mono">Version Update Note</label>
                              <input
                                type="text"
                                placeholder="E.g., Updated applicant certification details, new portfolio links"
                                value={newVersionNote}
                                onChange={(e) => setNewVersionNote(e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:bg-[#0d0d12]"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleUploadVersion}
                              disabled={uploadingVersion}
                              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50 shadow-md shadow-indigo-600/15"
                            >
                              {uploadingVersion ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                              <span>Commit Version Upgrade</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create custom folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewFolderModal(false)}
              className="absolute inset-0 bg-[#000000]/60 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#0d0d12]/95 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-white/15 z-10 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/5 border border-white/10 text-indigo-400 rounded-xl">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create New Directory</h3>
                  <p className="text-[11px] text-neutral-450 mt-0.5">Organize resumes, certificates or other portfolio attachments.</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wide font-bold font-mono">Directory Name</label>
                <input
                  id="new-folder-name-input"
                  type="text"
                  placeholder="E.g., Engineering Resumes"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 text-neutral-300 cursor-pointer transition duration-300"
                >
                  Cancel
                </button>
                <button
                  id="confirm-create-folder-btn"
                  onClick={handleCreateFolder}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold cursor-pointer transition duration-300 shadow-md shadow-indigo-600/15"
                >
                  Create Folder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
