import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectQuestionFileFormat, validateQuestionFileContent, validateQuestionFileMetadata, safeOriginalFileName, MAX_QUESTION_FILE_BYTES, MAX_UPLOAD_REQUEST_BYTES } from "../lib/uploads/validation";
import { readUploadFormData } from "../lib/uploads/read-upload";
import { createQuizSchema, patchQuizSchema, normalizeQuizQuestions, normalizeStoredFilePath, quizDatabaseFields } from "../lib/admin/quiz-input";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC","base64");
const jpeg = Buffer.from("/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z","base64");
const webp = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=","base64");
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

describe("problem file validation",()=>{
  it("recognizes supported containers and checks actual content against extension",()=>{
    for (const [name,type,bytes] of [["문제.png","image/png",png],["문제.jpeg","image/jpeg",jpeg],["문제.webp","image/webp",webp],["문제.pdf","application/pdf",pdf]] as const) {
      assert.equal(validateQuestionFileContent({name,type,size:bytes.length},bytes).ok,true,name);
      assert.equal(detectQuestionFileFormat(bytes)?.mimeType,type);
    }
    assert.equal(validateQuestionFileContent({name:"fake.pdf",type:"application/pdf",size:png.length},png).ok,false);
    assert.equal(validateQuestionFileContent({name:"fake.png",type:"image/png",size:18},Buffer.from("<script>x</script>")).ok,false);
  });
  it("rejects empty, oversized, mismatched, and unsupported documents",()=>{
    assert.ok(validateQuestionFileMetadata({name:"a.pdf",type:"application/pdf",size:0}));
    assert.ok(validateQuestionFileMetadata({name:"a.pdf",type:"application/pdf",size:MAX_QUESTION_FILE_BYTES+1}));
    assert.ok(validateQuestionFileMetadata({name:"a.hwp",type:"application/octet-stream",size:100}));
    assert.ok(validateQuestionFileMetadata({name:"a.png",type:"text/html",size:100}));
    assert.equal(validateQuestionFileMetadata({name:"a.pdf",type:"",size:MAX_QUESTION_FILE_BYTES}),null);
  });
  it("rejects truncated and out-of-bounds containers without crashing",()=>{
    for (const bytes of [png,jpeg,webp,pdf]) assert.equal(detectQuestionFileFormat(bytes.subarray(0,bytes.length-8)),null);
    const broken = Buffer.from(png); broken.writeUInt32BE(0xffffffff,33);
    assert.equal(detectQuestionFileFormat(broken),null);
    for(let n=0;n<80;n++) assert.doesNotThrow(()=>detectQuestionFileFormat(new Uint8Array(n).fill(255)));
  });
  it("sanitizes display filenames and bounds multipart streams",async()=>{
    assert.equal(safeOriginalFileName("../\\문제\u0000.pdf"),"문제.pdf");
    const body = new FormData();body.append("file",new File([png],"문제.png",{type:"image/png"}));
    const parsed=await readUploadFormData(new Request("https://site.test/upload",{method:"POST",body}));
    assert.equal((parsed.get("file") as File).name,"문제.png");
    await assert.rejects(readUploadFormData(new Request("https://site.test/upload",{method:"POST",headers:{"content-type":"multipart/form-data; boundary=x"},body:new Uint8Array(MAX_UPLOAD_REQUEST_BYTES+1)})),/용량/);
    await assert.rejects(readUploadFormData(new Request("https://site.test/upload",{method:"POST",headers:{"content-type":"text/plain"},body:"x"})),/형식/);
  });
});

describe("administrator quiz validation",()=>{
  const payload={subjectCode:"math" as const,title:"수학",published:false,questions:[{correctAnswer:"2/4",points:2}]};
  it("rejects malformed/oversized inputs and unsafe points",()=>{
    assert.equal(createQuizSchema.safeParse(payload).success,true);
    for(const value of [null,[],{...payload,title:" "},{...payload,title:"x".repeat(201)},{...payload,questions:[{correctAnswer:"1",points:0}]},{...payload,questions:Array(51).fill(payload.questions[0])}]) assert.equal(createQuizSchema.safeParse(value).success,false);
    assert.equal(patchQuizSchema.safeParse({}).success,false);
  });
  it("normalizes equivalent fractions and duplicate UUID casing",()=>{
    assert.equal(normalizeQuizQuestions(payload.questions,"math")[0].correct_answer,"1/2");
    const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    assert.throws(()=>normalizeQuizQuestions([{id,correctAnswer:"1",points:1},{id:id.toUpperCase(),correctAnswer:"2",points:1}],"math"),/중복/);
  });
  it("restricts file URLs to the configured bucket and rejects traversal",()=>{
    const origin="https://project.supabase.co";
    assert.equal(normalizeStoredFilePath(origin+"/storage/v1/object/public/quiz-files/2026/a.pdf",origin),"2026/a.pdf");
    for(const path of ["javascript:alert(1)","../a.pdf","a/../a.pdf","/a.pdf","x%2fa.pdf","https://other.test/a.pdf","a.svg"]) assert.throws(()=>normalizeStoredFilePath(path,origin));
    assert.equal(quizDatabaseFields({...payload,pdfStoragePath:"2026/a.pdf",questionFilePath:null}).question_file_path,"2026/a.pdf");
  });
});
