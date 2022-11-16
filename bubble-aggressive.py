import sys

import cv2
import numpy as np
import pandas as pd
import random
import pytesseract
from PIL import Image
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


debug_level = 2

def show_mask(name, contours, keys, img, colors):
    mask = cv2.cvtColor(np.zeros_like(img), cv2.COLOR_BGR2RGB)
    for i, key in zip(range(0, len(contours)), keys):
        color = colors[key]
        color = (int(color[0]), int(color[1]), int(color[2])) 
        cv2.drawContours(mask, contours, i, tuple(color), 1)
    cv2.imshow(name, mask)

def get_params():
    params = ""
    params += "--psm 12"

    configParams = []
    def configParam(param, val):
      return "-c " + param + "=" + val

    configParams.append(("chop_enable", "T"))
    configParams.append(('use_new_state_cost','F'))
    configParams.append(('segment_segcost_rating','F'))
    configParams.append(('enable_new_segsearch','0'))
    configParams.append(('textord_force_make_prop_words','F'))
    configParams.append(('tessedit_char_blacklist', '}><L'))
    configParams.append(('textord_debug_tabfind','0'))
    params += " ".join([configParam(p[0], p[1]) for p in configParams])
    return params
    

def has_sibling(i, keys, hierarchy, mode):
    if i == -1:
        return False
        
    self = hierarchy[i]
    if self[mode] in keys:
        return True
    
    return has_sibling(self[mode], keys, hierarchy, mode)
    
    
def has_decendent(i, keys, hierarchy):
    if i == -1:
        return False
        
    self = hierarchy[i]
    if self[2] in keys:
        return True
        
    if has_sibling(self[2], keys, hierarchy, 0) or has_sibling(self[2], keys, hierarchy, 1):
        return True
    
    return has_decendent(self[2], keys, hierarchy)
    
    
def get_blurbs(img):

  
  

  img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
  #_, img_gray = cv2.threshold(img_gray, 200, 255, cv2.THRESH_BINARY) 
  #img_gray = cv2.bitwise_not(cv2.adaptiveThreshold(img_gray, 255, cv2.THRESH_BINARY, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 75, 10))
  img_gray = cv2.adaptiveThreshold(img_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 75, 10)
  

  
  if debug_level >= 1:
      cv2.imshow("Binarization", img_gray)
      

  kernel = np.ones((2,2),np.uint8)
  img_gray = cv2.erode(img_gray, kernel,iterations = 2)
  
  if debug_level >= 1:
      cv2.imshow("Erosion", img_gray)
      cv2.waitKey(0)
  
  img_gray = cv2.bitwise_not(img_gray)

  height, width, channel = img.shape
  
  contours, hierarchy = cv2.findContours(img_gray, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
  
  t_inner = {}
  
  pruned_contours = {}
  pruned_hierarchy = hierarchy[0].copy()
  for i, cnt in enumerate(contours):
    area = cv2.contourArea(cnt)
    #if area > 100 and area < ((height / 3) * (width / 3)):
    if area > 100 and area < ((height * 0.95) * (width * 0.95)):
      pruned_contours[i] = cnt
    else:
      hier = hierarchy[0][i]
      # is innermost contour
      if hier[2] == -1 and hier[3] != -1:
        # parent is now innermost
        pruned_hierarchy[hier[3]][2] = -1
  
  level_2_contours = {}
  for i in pruned_contours.keys():
    hier = pruned_hierarchy[i]
    # get parent of innermost contour
    if hier[2] == -1 and hier[3] != -1:
      t_inner[i] = pruned_contours[i]
      i_parent = hier[3]
      if i_parent in pruned_contours and i_parent not in level_2_contours:
        level_2_contours[i_parent] = pruned_contours[i_parent]
        
  bubble_contours = {}
  for i in level_2_contours.keys():
    if not has_decendent(i, level_2_contours.keys(), hierarchy[0]):
        bubble_contours[i] = level_2_contours[i] #cv2.convexHull(level_2_contours[i])
    
  
  print("Found: ", len(bubble_contours))
  
  if debug_level >= 2:
    colors = np.random.randint(255, size=(len(contours), 3))
    
    show_mask("All Contours", contours, range(0, len(contours)), img, colors)
    #show_mask("Pruned", list(pruned_contours.values()), pruned_contours.keys(), img, colors)
    #show_mask("Innermost", list(t_inner.values()), t_inner.keys(), img, colors)
    show_mask("Mask", list(level_2_contours.values()), level_2_contours.keys(), img, colors)
    show_mask("Final", list(bubble_contours.values()), bubble_contours.keys(), img, colors)

    cv2.waitKey(0)


  blurbs = []
  for cnt in list(bubble_contours.values()):
    draw_mask = cv2.cvtColor(np.zeros_like(img), cv2.COLOR_BGR2GRAY)
    approx = cv2.approxPolyDP(cnt,0.01*cv2.arcLength(cnt,True),True)
    # pickle.dump(approx, open("approx.pkl", mode="w"))
    cv2.fillPoly(draw_mask, [approx], (255,0,0))
    image = cv2.bitwise_and(draw_mask, cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    # draw_mask_inverted = cv2.bitwise_not(draw_mask)
    # image = cv2.bitwise_or(image, draw_mask_inverted)
    y = approx[:, 0, 1].min()
    h = approx[:, 0, 1].max() - y
    x = approx[:, 0, 0].min()
    w = approx[:, 0, 0].max() - x
    image = image[y:y+h, x:x+w]
    
    pil_image = Image.fromarray(image)
    #text = pytesseract.image_to_string(pil_image, lang="jpn_vert", config=get_params())
    
    """
    text = pytesseract.image_to_data(pil_image, lang="jpn_vert", config=get_params(), output_type='data.frame')
    #text = text[text.conf > 70]
    lines = text.groupby('block_num')['text'].apply(list)
    conf = text.groupby(['block_num'])['conf'].mean()
    print("confidence: ", conf)
    print(lines)
    
    cv2.imshow("Segmented", image)
    cv2.waitKey(0)
    """


    
    #pil_image = Image.fromarray(image)
    #text = pytesseract.image_to_string(pil_image, lang="jpn_vert", config=get_params())
    #if text:
    #    print(text)
    
    
    if debug_level >= 3:
        cv2.imshow("Segmented", image)
        cv2.waitKey(0)
            

  

 
get_blurbs(cv2.imread("img2.jpg"))
