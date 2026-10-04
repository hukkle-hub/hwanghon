# doc 177 §18: Ain lower face shorter (chin 6.6 % low in the final photo) and eyes a little more open
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$env:LOWER_FACE_K = '0.92'; $env:SYMMETRIZE = '1'; $env:UPPER_LID_DROP = '-1.8'; $env:LOWER_LID_RAISE = '0'
& $bl -b -P C:\w\hwanghon\tools\metahuman\wrap_template.py -- C:/w/mhlab/template_Archetype.fbx C:/w/mhlab/ain2_head.glb C:/w/mhlab/ain_wrapped_jaw.fbx C:/w/mhlab/ain_wrap_jaw_preview.png 2>$null | Select-String "^WRAP (lower|upper|out)"
$env:UPPER_LID_DROP = '0'; $env:SYMMETRIZE = '0'; $env:MH_FACE_BC = ''
& C:\w\mhlab\jaw_chain.ps1 -Name Ain -Hair WI_Hair_M_SideSweptFringe -HairParams "Melanin=1,Redness=0.05" -IrisTint "1.0,0.15,0.1" -IrisSat "3.0" -Brow "" -BrowParams "" -Cap "1" -Darken "1"
